-- Portal Klien (Project Tracker): bobot tahap khusus per item.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_item.bobot_tahap
--   { "<tahap>": persen, ... } lengkap untuk semua tahap jenis item itu,
--   berjumlah 100. Diatur admin lewat slider di tab Progres.
--   Kosong = item memakai bobot jenisnya (portal_bobot_tahap / bawaan).

alter table portal_item add column if not exists bobot_tahap jsonb;

-- Supaya API Supabase langsung mengenali kolom baru.
notify pgrst, 'reload schema';
