-- Jalankan di Supabase Studio > SQL Editor
--
-- Absensi kunjungan Supervisor ke proyek. Beda mendasar dari checkin_harian:
--   • satu baris per KUNJUNGAN, bukan per hari — supervisor bisa mengunjungi
--     beberapa proyek dalam sehari, dan yang diukur adalah durasinya;
--   • di-key ke profiles.id, bukan chat_id Telegram;
--   • koordinat BENAR-BENAR disimpan. checkin_harian cuma menyimpan jam, jadi
--     sampai sekarang tidak ada jejak di mana orang absen dan tidak ada yang
--     bisa diaudit.
--
-- Titik acuan proyek TIDAK diambil dari kolom `lokasi`: separuh proyek aktif
-- nilainya null, dan yang terisi hanya turun sampai level gedung/cluster
-- ("Cluster Eonna, BSD" bisa meleset 1-2 km). Geofence di atas titik yang
-- meleset menolak supervisor yang justru benar-benar hadir. Titiknya diambil
-- sekali per proyek lewat tombol "Set titik proyek" saat berada di lokasi.

-- =====================================================================
-- 1) Titik acuan + radius per proyek
-- =====================================================================
-- Kolom-kolom ini aman dari syncProyekFromTaraco: upsert di sana hanya
-- menulis kolom yang disebut eksplisit (nama, lokasi, deadline, mandor_id,
-- supervisor_id, is_active), jadi titik yang sudah di-set tidak akan tertimpa
-- saat sinkronisasi berikutnya.
alter table proyek add column if not exists lat              double precision;
alter table proyek add column if not exists lng              double precision;
alter table proyek add column if not exists radius_meter     int not null default 300;
alter table proyek add column if not exists titik_diset_oleh uuid references profiles(id);
alter table proyek add column if not exists titik_diset_at   timestamptz;

-- =====================================================================
-- 2) Kunjungan
-- =====================================================================
create table if not exists kunjungan_supervisor (
  id             uuid primary key default gen_random_uuid(),
  proyek_id      uuid not null references proyek(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,

  mulai_at       timestamptz not null default now(),
  lat_masuk      double precision not null,
  lng_masuk      double precision not null,
  akurasi_masuk  numeric(8,1),          -- meter, dari GPS perangkat

  selesai_at     timestamptz,
  lat_keluar     double precision,
  lng_keluar     double precision,
  akurasi_keluar numeric(8,1),

  status         text not null default 'BERJALAN'
                 check (status in ('BERJALAN', 'SELESAI', 'TIDAK_SAH')),
  catatan_sistem text,                  -- alasan kalau TIDAK_SAH
  created_at     timestamptz default now()
);

create index if not exists idx_kunjungan_profile on kunjungan_supervisor(profile_id, mulai_at desc);
create index if not exists idx_kunjungan_proyek  on kunjungan_supervisor(proyek_id, mulai_at desc);

-- Satu orang tidak boleh punya 2 kunjungan berjalan sekaligus. Dijaga di
-- level database, bukan cuma di API route — supaya dua tap beruntun (atau
-- dua tab) tidak bisa menghasilkan kunjungan ganda.
create unique index if not exists idx_kunjungan_satu_berjalan
  on kunjungan_supervisor(profile_id) where status = 'BERJALAN';

-- =====================================================================
-- 3) RLS — SENGAJA select-only
-- =====================================================================
-- Tidak ada policy insert/update untuk user biasa, dan itu inti keamanannya:
-- satu-satunya jalan menulis adalah lewat /api/kunjungan, yang menghitung
-- jarak DI SERVER lalu menulis pakai service role.
--
-- Bandingkan dengan checkin_harian: policy-nya mengizinkan user menulis
-- barisnya sendiri, sementara pengecekan GPS-nya cuma di browser
-- (components/AbsensiSayaCard.jsx) — jadi bisa dilewati siapa pun yang
-- membuka devtools. Pola itu sengaja tidak diulang di sini.
alter table kunjungan_supervisor enable row level security;

drop policy if exists kunjungan_read on kunjungan_supervisor;
create policy kunjungan_read on kunjungan_supervisor for select
  using (
    profile_id = auth.uid()
    or my_role() in ('MASTER', 'FINANCE')
    or proyek_id in (select id from proyek where supervisor_id = auth.uid())
  );
