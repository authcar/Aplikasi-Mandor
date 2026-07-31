-- =====================================================================
-- APLIKASI MANDOR — Supabase Schema + RLS (KONSOLIDASI)
-- Terakhir disatukan: 2026-07-13
--
-- File ini adalah gabungan dari schema.sql lama + SEMUA file migrasi
-- add_*.sql / fix_*.sql di folder ini, DITAMBAH rekonstruksi tabel yang
-- selama ini dibuat manual di Supabase Studio (tidak pernah tercatat di
-- migrasi manapun) — direkonstruksi dari cara kode aplikasi memakainya.
--
-- Cara pakai:
--   • Database BARU/kosong  → jalankan file ini sendirian, cukup sekali.
--   • Database yang SUDAH JALAN (kondisi sekarang) → aman dijalankan
--     ulang, idempotent (pakai "if not exists" / "drop ... if exists"
--     di semua bagian) — berguna buat cek ada drift atau tidak.
--   • Perkecualian: ALTER TYPE ... ADD VALUE tidak boleh berada di
--     transaksi yang sama dengan pemakaian value itu di policy. Kalau
--     menjalankan file ini di database yang enumnya belum punya
--     MASTER/TUKANG_HARIAN, jalankan blok "ENUM" di bawah SENDIRIAN
--     dulu (Run terpisah), baru lanjutkan sisanya.
--
-- Bagian bertanda "REKONSTRUKSI" berarti tabel itu tidak pernah dibuat
-- lewat file .sql — kolomnya disimpulkan dari query di kode aplikasi
-- (bukan dari introspeksi database langsung). Cocokkan dengan Table
-- Editor di Studio sebelum benar-benar mengandalkan tipe/constraint-nya.
--
-- Riwayat file asal (masih disimpan di folder ini untuk arsip, TIDAK
-- perlu dijalankan lagi kalau sudah pakai file konsolidasi ini):
--   schema.sql (versi lama), add_master_role.sql, add_master_rls_fix.sql,
--   add_master_rls_gaps_untracked.sql, add_checklist_perbaikan.sql,
--   add_checkin_at.sql, add_tukang_harian_role.sql,
--   add_tukang_harian_proyek.sql, add_tukang_harian_pin.sql,
--   add_tukang_harian_profile_policies.sql, fix_proyek_read_recursion.sql,
--   fix_checklist_perbaikan_read_flags.sql, fix_potongan_gaji_rls.sql
-- =====================================================================

-- =====================================================================
-- ENUM
-- =====================================================================
do $$ begin
  create type user_role as enum ('MANDOR', 'SUPERVISOR', 'MASTER', 'TUKANG_HARIAN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_apr as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type jenis_uang as enum ('KASBON', 'REIMBURSE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_mslh as enum ('OPEN', 'IN_PROGRESS', 'DONE');
exception when duplicate_object then null; end $$;

-- CANCELLED dipakai oleh checklist_perbaikan (Supervisor membatalkan item;
-- item tetap tampil ke Mandor/Tukang Harian berlabel "Dibatalkan").
alter type status_mslh add value if not exists 'CANCELLED';

-- =====================================================================
-- PROFILES (terhubung ke auth.users)
-- =====================================================================
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       user_role not null default 'MANDOR',
  phone      text,
  created_at timestamptz default now()
);

-- pin: PIN 4 digit rahasia buat login TUKANG_HARIAN (4 digit terakhir
-- nomor HP + PIN ini). Diisi manual oleh mandor/supervisor lewat fitur
-- "Tambah Tukang Harian" di app (lihat app/api/tukang-harian/route.js).
alter table profiles add column if not exists pin text;
alter table profiles drop constraint if exists profiles_pin_format;
alter table profiles add constraint profiles_pin_format
  check (pin is null or pin ~ '^[0-9]{4}$');

-- REKONSTRUKSI — dua kolom di bawah TIDAK pernah dibuat lewat migrasi,
-- dipakai luas di app (lib/supabase/server.js getSessionProfile, halaman
-- gaji/dashboard). telegram_chat_id dipakai buat mencocokkan baris di
-- checkin_harian/potongan_gaji (tabel eksternal, diisi bot Telegram).
alter table profiles add column if not exists telegram_chat_id bigint;
alter table profiles add column if not exists gaji_pokok numeric(12,0);

-- =====================================================================
-- PROYEK
-- supervisor_id: 1 supervisor membawahi banyak proyek
-- mandor_id    : 1 mandor memegang proyek
-- =====================================================================
create table if not exists proyek (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,
  lokasi        text,
  supervisor_id uuid not null references profiles(id),
  mandor_id     uuid references profiles(id),
  is_active     boolean default true,
  created_at    timestamptz default now()
);
create index if not exists idx_proyek_supervisor on proyek(supervisor_id);
create index if not exists idx_proyek_mandor on proyek(mandor_id);

-- REKONSTRUKSI — nilai kontrak/jasa proyek, dipakai di dashboard
-- Mandor/Master & form Proyek Baru, tidak pernah lewat migrasi.
alter table proyek add column if not exists nilai_proyek numeric(14,0);

-- deadline: disinkron dari Taraco (projects.due_date) lewat
-- syncProyekFromTaraco, dipakai untuk sort & label "Proyek Saya" Supervisor.
-- Lihat supabase/add_proyek_deadline.sql.
alter table proyek add column if not exists deadline date;

-- proyek_id (di tabel profiles): proyek tetap milik akun TUKANG_HARIAN
-- (mandor/supervisor mengaitkan tukang harian ke 1 proyek lewat fitur
-- "Tambah Tukang Harian"). Mandor/Supervisor sendiri tidak pakai kolom
-- ini (mereka dikaitkan lewat proyek.mandor_id / proyek.supervisor_id).
-- Ditaruh di sini (bukan di blok PROFILES di atas) karena butuh tabel
-- proyek sudah ada duluan.
alter table profiles add column if not exists proyek_id uuid references proyek(id);

-- =====================================================================
-- TUKANG (pekerja di bawah mandor/proyek — daftar nama sederhana buat
-- roll-call manual; BEDA dengan profiles role=TUKANG_HARIAN yang punya
-- akun login sendiri)
-- =====================================================================
create table if not exists tukang (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references proyek(id) on delete cascade,
  nama        text not null,
  jabatan     text default 'Tukang',           -- Tukang / Kenek / Kepala
  upah_harian numeric(12,0) not null default 0, -- Rupiah, tanpa desimal
  is_active   boolean default true,
  created_at  timestamptz default now()
);
create index if not exists idx_tukang_proyek on tukang(proyek_id);

-- =====================================================================
-- ABSENSI (roll-call harian per tukang, tabel `tukang` di atas)
-- =====================================================================
create table if not exists absensi (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  tukang_id  uuid not null references tukang(id) on delete cascade,
  tanggal    date not null default current_date,
  hadir      boolean not null default true,
  upah_snap  numeric(12,0) not null default 0, -- snapshot upah saat absen
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  unique (tukang_id, tanggal)                  -- 1 tukang 1x per hari
);
create index if not exists idx_absensi_proyek_tgl on absensi(proyek_id, tanggal);

-- =====================================================================
-- FOTO PROGRES HARIAN (foto borongan suasana)
-- =====================================================================
create table if not exists progres_foto (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  tanggal    date not null default current_date,
  foto_url   text not null,                    -- path di storage bucket 'progres'
  catatan    text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_progres_proyek_tgl on progres_foto(proyek_id, tanggal);

-- =====================================================================
-- LEMBUR
-- =====================================================================
create table if not exists lembur (
  id           uuid primary key default gen_random_uuid(),
  proyek_id    uuid not null references proyek(id) on delete cascade,
  tukang_id    uuid references tukang(id) on delete cascade,
  tanggal      date not null default current_date,
  jam          numeric(4,1) not null,          -- jumlah jam lembur
  tarif_per_jam numeric(12,0) not null default 0,
  total        numeric(12,0) generated always as (jam * tarif_per_jam) stored,
  status       status_apr not null default 'PENDING',
  catatan      text,
  created_by   uuid not null references profiles(id), -- mandor/tukang harian
  reviewed_by  uuid references profiles(id),          -- supervisor/master
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);
create index if not exists idx_lembur_proyek_status on lembur(proyek_id, status);
-- tukang_id nullable: form pengajuan lembur (Mandor & Tukang Harian) cuma
-- mencatat jumlah orang × hari, bukan tukang tertentu — kolom ini tidak
-- pernah diisi lewat app.
alter table lembur alter column tukang_id drop not null;

-- =====================================================================
-- KEUANGAN (Kasbon + Reimburse jadi satu)
-- =====================================================================
create table if not exists keuangan (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references proyek(id) on delete cascade,
  tukang_id   uuid references tukang(id),       -- null utk reimburse umum
  jenis       jenis_uang not null,             -- KASBON | REIMBURSE
  nominal     numeric(12,0) not null,
  keterangan  text,
  nota_url    text,                            -- bucket 'nota' (utk reimburse)
  status      status_apr not null default 'PENDING',
  created_by  uuid not null references profiles(id),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz default now()
);
create index if not exists idx_keuangan_proyek_status on keuangan(proyek_id, status);

-- Badge notifikasi: KASBON baru belum dilihat Master; hasil approve/reject
-- belum dilihat pemohon (SPV utk kasbon, mandor/tukang harian utk reimburse).
alter table keuangan add column if not exists dibaca_master boolean not null default false;
alter table keuangan add column if not exists dibaca_pemohon boolean not null default true;

-- =====================================================================
-- MASALAH / KENDALA LAPANGAN (kurang material dll)
-- =====================================================================
create table if not exists masalah (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  judul      text not null,
  deskripsi  text,
  foto_url   text,                             -- bucket 'masalah'
  status     status_mslh not null default 'OPEN',
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_masalah_proyek on masalah(proyek_id);

-- REKONSTRUKSI — kolom detail material dipakai form Mandor/Tukang Harian
-- (MasalahForm.jsx) tapi tidak ada di schema.sql asli.
alter table masalah add column if not exists material text;
alter table masalah add column if not exists jumlah numeric;
alter table masalah add column if not exists satuan text;
alter table masalah add column if not exists urgensi text; -- 'Mendesak'|'Sedang'|'Rendah'

-- Badge notifikasi: perubahan status oleh Supervisor/Master belum dilihat
-- pelapor (mandor/tukang harian yang membuat laporan masalah ini).
alter table masalah add column if not exists dibaca_pelapor boolean not null default true;

-- =====================================================================
-- CHECKLIST PERBAIKAN (defect list — Supervisor lapor ke Mandor/Tukang
-- Harian proyek)
-- =====================================================================
create table if not exists checklist_perbaikan (
  id             uuid primary key default gen_random_uuid(),
  proyek_id      uuid not null references proyek(id) on delete cascade,
  no             int not null,
  uraian         text not null,               -- uraian pekerjaan perapihan
  foto_url       text,                        -- bucket 'perbaikan'
  periode        text,
  status         status_mslh not null default 'OPEN',
  dibaca_mandor  boolean not null default false, -- notifikasi "baru" ke mandor
  created_by     uuid not null references profiles(id), -- supervisor/master
  selesai_at     timestamptz,
  created_at     timestamptz default now()
);
create index if not exists idx_checklist_proyek on checklist_perbaikan(proyek_id);

-- Kolom terpisah utk badge "baru" milik Tukang Harian — dulu berbagi
-- dibaca_mandor dengan Mandor, jadi saling menghapus badge satu sama
-- lain kalau salah satu buka duluan (bug, sudah diperbaiki lewat kolom
-- terpisah ini, bukan lewat migrasi data dibaca_mandor).
alter table checklist_perbaikan
  add column if not exists dibaca_tukang_harian boolean not null default false;

-- =====================================================================
-- REKONSTRUKSI — ABSENSI_RINGKAS, ABSENSI_TIM, ABSENSI_TIM_FOTO,
-- CHECKIN_HARIAN, POTONGAN_GAJI
-- Kelima tabel ini TIDAK PERNAH dibuat lewat file .sql di folder ini —
-- dibuat manual di Supabase Studio. Kolom di bawah disimpulkan dari
-- app/api/absensi/route.js, app/api/absensi-mandor/route.js,
-- app/api/potongan/route.js, app/supervisor/absensi/AbsensiTimForm.jsx,
-- dan halaman gaji/dashboard tiap role. Constraint (unique/not null)
-- SENGAJA tidak ditambah kecuali sudah pasti kepakai di kode — supaya
-- file ini tidak "berbohong" soal apa yang benar-benar berlaku di
-- database sekarang. Cek Table Editor di Studio kalau butuh kepastian.
-- =====================================================================

-- absensi_ringkas: rekap jumlah hadir per proyek per hari (dipakai
-- dashboard Mandor/Supervisor/Master untuk kartu "Hadir hari ini").
-- Kemungkinan besar (proyek_id, tanggal) unik di praktiknya — app selalu
-- cek existing dulu sebelum insert/update (pola upsert manual) — tapi
-- tidak ditambahkan sebagai constraint di sini karena belum terverifikasi.
create table if not exists absensi_ringkas (
  id                    uuid primary key default gen_random_uuid(),
  proyek_id             uuid references proyek(id) on delete cascade,
  tanggal               date not null,
  jumlah_hadir          int not null default 0,
  tidak_ada_pengerjaan  boolean not null default false,
  created_by            uuid references profiles(id),
  created_at            timestamptz default now()
);

-- absensi_tim: laporan harian Supervisor per tim (BUKAN per proyek —
-- tabel ini TIDAK punya kolom proyek_id sama sekali; datanya company-wide
-- per hari, dikelompokkan lewat kolom `tim`, bukan lewat proyek). Ini
-- alasan kebijakan absensi_tim_rw di bawah tidak menyaring proyek_id
-- seperti tabel lain — bukan bug RLS, tapi karena modelnya memang
-- tidak granular per proyek.
create table if not exists absensi_tim (
  id         uuid primary key default gen_random_uuid(),
  tanggal    date not null,
  tim        text not null,
  jumlah     int,             -- null = baris "bernama" (dihitung 1 orang)
  kegiatan   text not null,
  urutan     int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- absensi_tim_foto: dokumentasi foto harian, terpisah dari absensi_tim.
create table if not exists absensi_tim_foto (
  id         uuid primary key default gen_random_uuid(),
  tanggal    date not null,
  foto_url   text not null,   -- path di storage bucket 'absensi'
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- checkin_harian: absensi lokasi harian tiap akun (semua role), keyed
-- lewat chat_id (Telegram) — BUKAN foreign key ke profiles.id langsung,
-- dicocokkan lewat profiles.telegram_chat_id di kebijakan RLS-nya.
create table if not exists checkin_harian (
  id         uuid primary key default gen_random_uuid(),
  chat_id    text not null,
  tanggal    date not null,
  created_at timestamptz default now()
);
-- checkin_at: jam checkin, dipakai kartu "Absensi Saya" (Masuk/Pulang/Total Jam).
alter table checkin_harian add column if not exists checkin_at timestamptz;

-- potongan_gaji: potongan gaji per hari (dari bot Telegram, di luar app
-- ini). App HANYA membaca (read-only dari sisi web), tidak pernah insert.
create table if not exists potongan_gaji (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null,
  tanggal     date not null,
  persentase  numeric not null default 0,
  created_at  timestamptz default now()
);

-- Badge notifikasi: potongan baru (diisi bot Telegram/n8n) belum dilihat
-- Supervisor di halaman Rekap Gaji.
alter table potongan_gaji add column if not exists dibaca_supervisor boolean not null default false;

-- =====================================================================
-- HELPER: ambil role user yang sedang login (hindari rekursi RLS)
-- =====================================================================
create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- proyek_id mana saja yang boleh diakses user ini? (mandor/supervisor
-- pemilik proyek, tukang harian yang ditugaskan, atau MASTER = semua proyek)
create or replace function my_proyek_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from proyek
  where mandor_id = auth.uid() or supervisor_id = auth.uid()
  union
  select proyek_id from profiles where id = auth.uid() and proyek_id is not null
  union
  select id from proyek
  where (select role from profiles where id = auth.uid()) = 'MASTER'
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Aturan inti:
--   MANDOR         -> proyek yg mandor_id = dirinya
--   SUPERVISOR     -> proyek yg supervisor_id = dirinya
--   TUKANG_HARIAN  -> 1 proyek tetap (profiles.proyek_id)
--   MASTER         -> semua proyek
--   Approval (status lembur/keuangan) hanya boleh diubah SUPERVISOR/MASTER
-- =====================================================================
alter table profiles          enable row level security;
alter table proyek            enable row level security;
alter table tukang            enable row level security;
alter table absensi           enable row level security;
alter table progres_foto      enable row level security;
alter table lembur            enable row level security;
alter table keuangan          enable row level security;
alter table masalah           enable row level security;
alter table checklist_perbaikan enable row level security;
alter table absensi_ringkas   enable row level security;
alter table absensi_tim       enable row level security;
alter table checkin_harian    enable row level security;
alter table potongan_gaji     enable row level security;
-- absensi_tim_foto: TIDAK ADA kebijakan RLS eksplisit ditemukan di
-- migrasi manapun. Kalau RLS aktif tanpa policy, tabel ini akan
-- terkunci total (bahkan utk pemiliknya) — verifikasi status RLS-nya di
-- Studio (Authentication > Policies) sebelum benar-benar diandalkan.

-- PROFILES
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select
  using (id = auth.uid()
         or exists (select 1 from proyek p
                    where p.supervisor_id = auth.uid() and p.mandor_id = profiles.id));
-- ^ CATATAN: kebijakan ini query ke `proyek`. Kebijakan `proyek_read` di
-- bawah SENGAJA tidak query balik ke `profiles`, supaya tidak terjadi
-- rekursi tak berhingga (pernah kejadian, lihat riwayat
-- fix_proyek_read_recursion.sql). Kalau nanti ada perubahan di salah
-- satu, pastikan arah dependensi ini tidak dibalik.

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid());

drop policy if exists profiles_list_mandor on profiles;
create policy profiles_list_mandor on profiles for select
  using (my_role() = 'SUPERVISOR' and role = 'MANDOR');

drop policy if exists profiles_list_for_master on profiles;
create policy profiles_list_for_master on profiles for select
  using (my_role() = 'MASTER' and role in ('SUPERVISOR', 'MANDOR'));

drop policy if exists profiles_list_tukang_harian on profiles;
create policy profiles_list_tukang_harian on profiles for select
  using (role = 'TUKANG_HARIAN' and proyek_id in (select my_proyek_ids()));

-- PROYEK
drop policy if exists proyek_read on proyek;
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid()
         or supervisor_id = auth.uid()
         or id in (select my_proyek_ids()));

drop policy if exists proyek_write on proyek;
create policy proyek_write on proyek for all
  using (supervisor_id = auth.uid() or my_role() = 'MASTER')
  with check (supervisor_id = auth.uid() or my_role() = 'MASTER');

-- TUKANG
drop policy if exists tukang_rw on tukang;
create policy tukang_rw on tukang for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()));

-- ABSENSI
drop policy if exists absensi_read on absensi;
create policy absensi_read on absensi for select
  using (proyek_id in (select my_proyek_ids()));
drop policy if exists absensi_write on absensi;
create policy absensi_write on absensi for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());
drop policy if exists absensi_update on absensi;
create policy absensi_update on absensi for update
  using (proyek_id in (select my_proyek_ids()));

-- PROGRES FOTO
drop policy if exists progres_read on progres_foto;
create policy progres_read on progres_foto for select
  using (proyek_id in (select my_proyek_ids()));
drop policy if exists progres_write on progres_foto;
create policy progres_write on progres_foto for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());

-- LEMBUR: semua pihak proyek bisa baca; mandor/tukang harian insert;
-- HANYA supervisor/master ubah status
drop policy if exists lembur_read on lembur;
create policy lembur_read on lembur for select
  using (proyek_id in (select my_proyek_ids()));
drop policy if exists lembur_insert on lembur;
create policy lembur_insert on lembur for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());
drop policy if exists lembur_review on lembur;
create policy lembur_review on lembur for update
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() = 'MASTER'
  );

-- KEUANGAN: sama polanya dgn lembur
drop policy if exists keuangan_read on keuangan;
create policy keuangan_read on keuangan for select
  using (proyek_id in (select my_proyek_ids()));
drop policy if exists keuangan_insert on keuangan;
create policy keuangan_insert on keuangan for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());
drop policy if exists keuangan_review on keuangan;
create policy keuangan_review on keuangan for update
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() = 'MASTER'
  );

-- MASALAH
drop policy if exists masalah_read on masalah;
create policy masalah_read on masalah for select
  using (proyek_id in (select my_proyek_ids()));
drop policy if exists masalah_write on masalah;
create policy masalah_write on masalah for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()));

-- CHECKLIST PERBAIKAN: siapa saja yang terlibat di proyek boleh baca & tulis
drop policy if exists checklist_rw on checklist_perbaikan;
create policy checklist_rw on checklist_perbaikan for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()));

-- ABSENSI_RINGKAS
drop policy if exists absensi_ringkas_rw on absensi_ringkas;
create policy absensi_ringkas_rw on absensi_ringkas for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());

-- ABSENSI_TIM: tabel ini tidak punya proyek_id (lihat catatan di definisi
-- tabel di atas) — kebijakan ini sengaja hanya memastikan caller adalah
-- pengguna proyek yang sah (punya minimal 1 proyek), bukan menyaring per
-- proyek tertentu, karena datanya memang company-wide.
drop policy if exists absensi_tim_rw on absensi_tim;
create policy absensi_tim_rw on absensi_tim for all
  using (
    exists (select 1 from proyek p where p.id in (select my_proyek_ids()))
    or my_role() = 'MASTER'
  )
  with check (created_by = auth.uid() or my_role() = 'MASTER');

-- CHECKIN_HARIAN: tiap akun boleh baca/tulis baris MILIKNYA SENDIRI,
-- dicocokkan lewat chat_id (fallback ke profile.id kalau belum terhubung
-- Telegram).
drop policy if exists checkin_harian_own_rw on checkin_harian;
create policy checkin_harian_own_rw on checkin_harian for all
  using (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  )
  with check (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  );

-- POTONGAN_GAJI: read-only milik sendiri. Insert/update sengaja TIDAK
-- diberi kebijakan — diisi lewat proses lain (bot Telegram pakai
-- service-role key, otomatis bypass RLS).
drop policy if exists potongan_gaji_own_read on potongan_gaji;
create policy potongan_gaji_own_read on potongan_gaji for select
  using (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  );

-- =====================================================================
-- AUTO-CREATE PROFILE saat user baru daftar
-- =====================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'MANDOR'));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- STORAGE BUCKETS — private
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('progres','progres',false), ('nota','nota',false),
       ('masalah','masalah',false), ('perbaikan','perbaikan',false),
       ('lembur','lembur',false)
on conflict (id) do nothing;

-- REKONSTRUKSI — bucket 'lembur' (foto bukti lembur, LemburForm.jsx) dan
-- 'absensi' (dokumentasi absensi_tim_foto, AbsensiTimForm.jsx) dipakai
-- kode tapi tidak pernah dibuat lewat migrasi manapun.
insert into storage.buckets (id, name, public)
values ('absensi','absensi',false)
on conflict (id) do nothing;

-- Akses storage: user boleh baca/tulis file di proyek yang ia akses.
-- Konvensi path file: '<proyek_id>/<nama_file>' — berlaku utk progres,
-- nota, masalah, perbaikan, lembur (semua di-upload dgn path diawali
-- proyek_id, cocok di-cast ke uuid di bawah).
drop policy if exists storage_read on storage.objects;
create policy storage_read on storage.objects for select
  using (bucket_id in ('progres','nota','masalah','perbaikan','lembur')
         and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()));
drop policy if exists storage_write on storage.objects;
create policy storage_write on storage.objects for insert
  with check (bucket_id in ('progres','nota','masalah','perbaikan','lembur')
         and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()));

-- Bucket 'absensi' TIDAK ikut policy di atas — pathnya '<tanggal>/<file>'
-- (bukan diawali proyek_id, konsisten dgn absensi_tim yang company-wide,
-- lihat catatan di definisi tabel absensi_tim), jadi mencocokkan folder
-- pertama sebagai uuid proyek akan gagal/salah. Kebijakan terpisah:
-- siapa pun yang punya minimal 1 proyek (atau MASTER) boleh akses,
-- sama seperti absensi_tim_rw.
drop policy if exists storage_absensi_rw on storage.objects;
create policy storage_absensi_rw on storage.objects for all
  using (
    bucket_id = 'absensi'
    and (exists (select 1 from proyek p where p.id in (select my_proyek_ids())) or my_role() = 'MASTER')
  )
  with check (
    bucket_id = 'absensi'
    and (exists (select 1 from proyek p where p.id in (select my_proyek_ids())) or my_role() = 'MASTER')
  );
