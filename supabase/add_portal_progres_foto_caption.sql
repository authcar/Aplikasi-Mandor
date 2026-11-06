-- Caption (keterangan) per foto progres item di Project Tracker. Dipakai di
-- galeri foto dan sebagai keterangan foto di PDF laporan mingguan.
-- Butuh add_portal_progres_foto.sql sudah dijalankan.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_progres_foto add column if not exists caption text;

notify pgrst, 'reload schema';
