-- Jalankan di Supabase Studio > SQL Editor
--
-- Absensi pegawai: clock in / clock out harian + lokasi, dengan selfie
-- berstempel lokasi yang diambil di HP.
--
-- Yang disimpan HANYA jam & koordinat. Fotonya sengaja tidak pernah diunggah
-- atau disimpan — selfie berstempel cuma tampil di layar saat absen.
--
-- Beda dari checkin_harian (sistem lama): jam diambil dari SERVER (bukan jam
-- HP), koordinat ikut disimpan, dan tabel ini tidak bisa ditulis langsung dari
-- browser — satu-satunya jalan lewat /api/absensi-pegawai.
--
-- Tidak ada geofence: pegawai boleh absen dari proyek mana pun. Lokasi dicatat
-- apa adanya; kalau dekat titik sebuah proyek, nama proyeknya ikut disimpan
-- sebagai label (kolom lokasi_*), kalau tidak ya kosong.

-- =====================================================================
-- 1) Penanda siapa yang wajib absen
-- =====================================================================
alter table profiles add column if not exists wajib_absen boolean not null default false;

-- =====================================================================
-- 2) Tabel absensi — satu baris per orang per hari (WIB)
-- =====================================================================
create table if not exists absensi_pegawai (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  tanggal        date not null,

  masuk_at       timestamptz not null default now(),
  lat_masuk      double precision not null,
  lng_masuk      double precision not null,
  akurasi_masuk  numeric(8,1),
  lokasi_masuk   text,
  terlambat      boolean not null default false,

  keluar_at      timestamptz,
  lat_keluar     double precision,
  lng_keluar     double precision,
  akurasi_keluar numeric(8,1),
  lokasi_keluar  text,
  pulang_cepat   boolean not null default false,

  created_at     timestamptz default now(),
  unique (profile_id, tanggal)
);

create index if not exists idx_absensi_pegawai_tanggal on absensi_pegawai(tanggal desc);

-- =====================================================================
-- 3) RLS — SENGAJA select-only
-- =====================================================================
-- Tidak ada policy insert/update: penulisan hanya lewat /api/absensi-pegawai
-- (service role), yang mengambil jam dari server. Kalau user bisa menulis
-- barisnya sendiri, jam masuk bisa dipalsukan lewat devtools.
alter table absensi_pegawai enable row level security;

drop policy if exists absensi_pegawai_read on absensi_pegawai;
create policy absensi_pegawai_read on absensi_pegawai for select
  using (
    profile_id = auth.uid()
    or my_role() in ('MASTER', 'FINANCE')
  );
