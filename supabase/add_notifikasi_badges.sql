-- Jalankan di Supabase Studio > SQL Editor
-- Notifikasi red-dot lintas role, meniru pola dibaca_mandor/dibaca_tukang_harian
-- yang sudah ada di checklist_perbaikan.
--
-- keuangan.dibaca_master   — Master belum lihat pengajuan KASBON baru dari SPV.
-- keuangan.dibaca_pemohon  — Pemohon (SPV utk kasbon, mandor/tukang harian utk
--                            reimburse) belum lihat hasil approve/reject.
-- laporan_harian.dibaca_master — Master belum lihat laporan harian baru dari SPV.
-- masalah.dibaca_pelapor   — Pelapor (mandor/tukang harian) belum lihat
--                            perubahan status dari Supervisor/Master.

alter table keuangan
  add column if not exists dibaca_master boolean not null default false,
  add column if not exists dibaca_pemohon boolean not null default true;

alter table laporan_harian
  add column if not exists dibaca_master boolean not null default false;

alter table masalah
  add column if not exists dibaca_pelapor boolean not null default true;
