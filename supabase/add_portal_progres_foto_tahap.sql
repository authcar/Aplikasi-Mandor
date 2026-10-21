-- Portal Klien: foto progres dikaitkan ke tahap pekerjaan (Potong, Rakit, Tusir, ...).
-- Kolom tahap boleh kosong (foto umum item, dan foto yang diunggah sebelum
-- kolom ini ada). Butuh add_portal_progres_foto.sql sudah dijalankan.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_progres_foto add column if not exists tahap text;

notify pgrst, 'reload schema';
