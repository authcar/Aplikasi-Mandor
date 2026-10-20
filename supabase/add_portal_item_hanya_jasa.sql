-- Portal Klien (Project Tracker): item yang hanya masuk Jasa tukang.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_item.hanya_jasa
--   true = baris Excel Hitungan Jasa Pekerjaan yang tidak bernomor (aksesoris,
--   LED strip, dll.). Tampil dan dihitung di tab Jasa tukang, tapi tidak muncul
--   di Progres dan tidak ikut menghitung persen progres.

alter table portal_item add column if not exists hanya_jasa boolean default false;

-- Supaya API Supabase langsung mengenali kolom baru.
notify pgrst, 'reload schema';
