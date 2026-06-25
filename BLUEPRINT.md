# Aplikasi Mandor — Blueprint & Implementasi

Web-app mobile-first untuk manajemen proyek konstruksi/lapangan. Dua peran: **MANDOR** (input data lapangan) dan **SUPERVISOR** (verifikasi & approval). Didesain super simpel, ringan, dan hemat kuota untuk HP Android spek rendah.

## Tech Stack (rekomendasi untuk single developer)

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Frontend + backend (API Route) dalam satu repo, mudah deploy. |
| Styling | **Tailwind CSS** | Ringan, tanpa runtime, kelas utility langsung. |
| Backend/DB | **Supabase** (Postgres + Auth + Storage + RLS) | Auth, database, file storage, dan keamanan baris (RLS) jadi satu. Gratis untuk mulai. |
| Hosting | **Vercel** | Deploy 1 klik dari GitHub, gratis untuk proyek kecil. |

**Kenapa Supabase, bukan Firebase?** Kebutuhan utama Anda adalah relasi (Supervisor → banyak Proyek → banyak Tukang) dan aturan akses per baris. Postgres + RLS menangani ini secara native dengan SQL yang jelas; Firestore (NoSQL) akan memaksa denormalisasi data dan security rules yang lebih rumit untuk relasi seperti ini.

**Optimasi HP jadul / hemat kuota** yang sudah diterapkan: tanpa library animasi, server-render data (payload kecil), kompresi response aktif, gambar dikirim sebagai foto kamera langsung ke Storage (bukan lewat server), tombol & teks besar untuk pengguna gaptek, dan signed URL untuk nota agar gambar hanya dimuat saat dibutuhkan.

---

## 1. Database Schema & Row-Level Security (RLS)

File lengkap siap jalan: [`supabase/schema.sql`](supabase/schema.sql). Jalankan sekali di **Supabase Studio → SQL Editor**.

### Tabel & Relasi

```
auth.users ──1:1── profiles (id, name, role[MANDOR|SUPERVISOR])
                      │
        supervisor_id │  mandor_id
                      ▼
                   proyek ──1:N── tukang
                      │              │
                      ├──1:N── absensi (roll-call harian, snapshot upah)
                      ├──1:N── progres_foto (foto suasana harian)
                      ├──1:N── lembur     (status PENDING/APPROVED/REJECTED)
                      ├──1:N── keuangan   (KASBON | REIMBURSE + nota_url + status)
                      └──1:N── masalah    (kendala lapangan + foto)
```

Logika relasi inti: tabel `proyek` punya dua foreign key ke `profiles` — `supervisor_id` dan `mandor_id`. **Satu supervisor bisa membawahi banyak proyek/mandor** karena `supervisor_id` boleh berulang di banyak baris `proyek`. Satu mandor memegang proyek lewat `mandor_id`. Semua data lapangan (absensi, lembur, keuangan, masalah) menggantung pada `proyek_id`, sehingga akses cukup diatur di level proyek.

### Aturan keamanan (RLS) — penjelasan singkat

Dua fungsi helper jadi kunci agar policy tidak berulang dan tidak rekursif:

- `my_role()` → mengembalikan role user yang sedang login.
- `my_proyek_ids()` → mengembalikan semua `proyek.id` di mana user adalah mandor **atau** supervisornya.

Dari situ aturannya jadi sederhana dan seragam:

- **Mandor hanya melihat proyeknya sendiri.** Semua policy `SELECT` pada absensi/lembur/keuangan/masalah memakai `proyek_id in (select my_proyek_ids())`. Karena seorang mandor hanya muncul di proyek dengan `mandor_id = dirinya`, ia otomatis tidak bisa melihat data proyek lain.
- **Supervisor melihat semua proyek di bawah kendalinya.** Fungsi `my_proyek_ids()` juga mengembalikan proyek dengan `supervisor_id = dirinya`, jadi supervisor melihat seluruh proyek/mandor yang ia bawahi — tanpa policy terpisah.
- **Hanya Mandor yang menginput**, dipastikan lewat `with check (... and created_by = auth.uid())` pada policy `INSERT`.
- **Hanya Supervisor yang meng-approve.** Policy `UPDATE` pada `lembur` & `keuangan` (`lembur_review`, `keuangan_review`) mensyaratkan `my_role() = 'SUPERVISOR'` dan proyek tersebut miliknya. Jadi mandor tidak bisa mengubah status pengajuannya sendiri jadi APPROVED.
- **File (Storage)** memakai konvensi path `'<proyek_id>/<file>'`; policy storage mengecek folder pertama path ada di `my_proyek_ids()`, sehingga foto/nota hanya bisa diakses oleh pihak proyek tersebut.

---

## 2. System Architecture & API Routes

### Struktur folder

```
aplikasi-mandor/
├── supabase/schema.sql            # schema + RLS + storage buckets
├── middleware.js                  # proteksi rute + redirect sesuai role
├── lib/
│   ├── supabase/client.js         # client browser
│   ├── supabase/server.js         # client server + getSessionProfile()
│   └── format.js                  # rupiah(), tglID()
├── components/LogoutButton.jsx
└── app/
    ├── login/page.jsx
    ├── page.jsx                   # redirect ke /mandor atau /supervisor
    ├── api/
    │   ├── approval/route.js      # Supervisor approve/reject
    │   ├── absensi/route.js       # Bulk insert absensi
    │   └── keuangan/route.js      # Input pengeluaran + upload nota
    ├── mandor/                    # ── area MANDOR ──
    │   ├── page.jsx               # Dashboard Mandor
    │   ├── absensi/               # roll-call + foto
    │   ├── lembur/                # lembur & kasbon
    │   ├── reimburse/             # klaim + nota
    │   ├── masalah/               # lapor kendala
    │   └── gaji/                  # rekap biaya harian/mingguan
    └── supervisor/                # ── area SUPERVISOR ──
        ├── page.jsx               # Dashboard Supervisor + tombol "Proyek Baru"
        ├── persetujuan/           # daftar PENDING + approve/reject
        └── proyek/
            ├── baru/              # form buat proyek baru
            └── [id]/              # kelola proyek: tetapkan mandor, tambah tukang
```

Pemisahan peran dilakukan lewat folder `app/mandor/*` dan `app/supervisor/*`. `middleware.js` mengecek role di setiap request: user tanpa login dilempar ke `/login`, mandor yang mencoba buka `/supervisor` dialihkan ke `/mandor`, dan sebaliknya. RLS di database menjadi lapis pertahanan kedua jika ada yang menembus rute.

### API Route — Approval oleh Supervisor

File: [`app/api/approval/route.js`](app/api/approval/route.js). Inti logikanya — mengubah `PENDING` → `APPROVED`/`REJECTED` dengan guard role dan anti double-review:

```js
const { tipe, id, aksi } = await req.json(); // tipe: 'lembur'|'keuangan'
if (profile.role !== "SUPERVISOR") return 403;

const { data } = await supabase
  .from(tipe)
  .update({ status: aksi, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
  .eq("id", id)
  .eq("status", "PENDING")   // cegah approve dua kali
  .select().single();
```

---

## 3. Core Backend Logic

### Bulk Insert Absensi (centang banyak tukang, satu klik)

File: [`app/api/absensi/route.js`](app/api/absensi/route.js). Mandor mengirim array `hadir_ids`; server mengambil seluruh tukang aktif proyek, membuat satu baris per tukang (hadir/tidak), menyimpan snapshot upah, lalu `upsert` sekaligus (boleh dikoreksi di hari yang sama berkat `unique (tukang_id, tanggal)`):

```js
const rows = tukangs.map((t) => ({
  proyek_id, tukang_id: t.id, tanggal: tgl,
  hadir: hadirSet.has(t.id),
  upah_snap: hadirSet.has(t.id) ? t.upah_harian : 0,
  created_by: profile.id,
}));
await supabase.from("absensi").upsert(rows, { onConflict: "tukang_id,tanggal" });
```

### Input Pengeluaran + Upload Nota

File: [`app/api/keuangan/route.js`](app/api/keuangan/route.js). Menerima `multipart/form-data`; jika ada file nota, diunggah ke bucket `nota` dengan path `'<proyek_id>/<uuid>.<ext>'`, lalu baris keuangan dibuat dengan status `PENDING`:

```js
if (nota?.size > 0) {
  const path = `${proyek_id}/${crypto.randomUUID()}.${ext}`;
  await supabase.storage.from("nota").upload(path, nota, { contentType: nota.type });
  nota_url = path;
}
await supabase.from("keuangan").insert({ proyek_id, jenis, nominal, keterangan, nota_url, created_by });
```

---

## 4. Frontend Components (Mobile-First)

- **A. Dashboard Mandor** — [`app/mandor/page.jsx`](app/mandor/page.jsx): ringkasan hari ini (jumlah hadir + upah) dan tombol cepat besar ke Absensi, Lembur/Kasbon, Reimburse, Lapor Masalah, dan Rekap Gaji.
- **B. Persetujuan Supervisor** — [`app/supervisor/persetujuan/page.jsx`](app/supervisor/persetujuan/page.jsx) + [`ApprovalList.jsx`](app/supervisor/persetujuan/ApprovalList.jsx): daftar pengajuan lembur & reimburse berstatus `PENDING` dengan tombol **Setujui** (hijau) dan **Tolak** (merah); kartu langsung hilang dari layar setelah diproses.

Komponen lain yang ikut disertakan agar aplikasi utuh: roll-call absensi (`absensi/RollCall.jsx`), form lembur/kasbon, form reimburse, form lapor masalah, dan halaman rekap gaji.

---

## 5. Deployment Guide (Vercel + Supabase)

**A. Siapkan Supabase**
1. Buat project di [supabase.com](https://supabase.com) → catat **Project URL** dan **anon key** (Settings → API).
2. Buka **SQL Editor**, tempel isi `supabase/schema.sql`, jalankan. Ini membuat tabel, RLS, trigger, dan bucket.
3. (Auth) Settings → Authentication → matikan "Confirm email" agar mandor bisa langsung login dengan akun yang Anda buatkan.
4. Buat user pertama lewat **Authentication → Add user**. Untuk menandai sebagai Supervisor, set user metadata `{"name":"Budi","role":"SUPERVISOR"}` (trigger `handle_new_user` akan membuat profil otomatis).

**B. Deploy ke Vercel**
1. Push project ini ke GitHub.
2. Di [vercel.com](https://vercel.com) → New Project → import repo tersebut.
3. Tambahkan Environment Variables (dari `.env.local.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Klik **Deploy**. Selesai — aplikasi otomatis live di URL `*.vercel.app`.

**C. Jalankan lokal lebih dulu (opsional)**
```bash
npm install
cp .env.local.example .env.local   # isi URL + anon key
npm run dev                         # buka http://localhost:3000
```

**D. Catatan operasional**
- Tukang **tidak** memakai aplikasi — mereka tidak punya akun. Mandor yang menginput semua data tukang.
- **Supervisor membuat proyek langsung dari web**: Dashboard Supervisor → "+ Proyek Baru" → isi nama/lokasi & pilih mandor. Lalu buka proyek tersebut untuk menambah tukang dan mengganti mandor. RLS memastikan `supervisor_id` selalu = dirinya sendiri.
- Yang masih perlu dibuat lewat Supabase hanyalah **akun login** (auth user) untuk Mandor baru, karena membuat akun + password butuh hak admin. Setelah akun mandor ada, semua pengelolaan proyek/tukang dilakukan dari web. (Bisa dibuatkan halaman "Undang Mandor" memakai service-role key bila diinginkan.)
- Login mandor memakai pola `nomorHP@mandor.app` + sandi agar mudah diingat (lihat `app/login/page.jsx`).
