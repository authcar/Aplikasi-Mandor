-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_absensi_pegawai.sql.
--
-- Foto selfie absen + alamat, dan arsip PDF bulanan.
--
-- Alur:
--   * Tiap absen masuk/pulang, selfie berstempel (sudah dikompres di HP) diunggah
--     ke bucket privat 'absensi-pegawai' lewat /api/absensi-pegawai. Yang ada di
--     tabel hanya path-nya.
--   * Per bulan kalender (Nov, Des, ...) Master/Finance bisa mengunduh satu PDF
--     berisi semua foto. Setelah bulan berakhir, PDF disimpan permanen di bucket
--     yang sama (arsip/YYYY-MM.pdf) dan foto satuannya dihapus supaya storage
--     tidak menumpuk (/api/absensi-pegawai/tutup-bulan, dipanggil n8n).
--   * Baris absen (jam, koordinat, alamat) TIDAK ikut terhapus; hanya kolom
--     foto_*_path yang dikosongkan.

-- =====================================================================
-- 1) Kolom foto & alamat
-- =====================================================================
alter table absensi_pegawai add column if not exists foto_masuk_path  text;
alter table absensi_pegawai add column if not exists foto_keluar_path text;
alter table absensi_pegawai add column if not exists alamat_masuk     text;
alter table absensi_pegawai add column if not exists alamat_keluar    text;

-- =====================================================================
-- 2) Bucket privat — tanpa policy: unggah & unduh hanya lewat server
--    (service role / signed URL)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('absensi-pegawai', 'absensi-pegawai', false)
on conflict (id) do nothing;

-- =====================================================================
-- 3) Arsip PDF per bulan
-- =====================================================================
create table if not exists absensi_pegawai_arsip (
  bulan          text primary key check (bulan ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  pdf_path       text not null,
  jumlah_foto    int  not null default 0,
  dibuat_at      timestamptz not null default now(),
  foto_dihapus_at timestamptz
);

alter table absensi_pegawai_arsip enable row level security;

drop policy if exists absensi_pegawai_arsip_read on absensi_pegawai_arsip;
create policy absensi_pegawai_arsip_read on absensi_pegawai_arsip for select
  using (my_role() in ('MASTER', 'FINANCE'));
