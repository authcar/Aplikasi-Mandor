-- Jalankan di Supabase Studio > SQL Editor
-- Tambah role TUKANG_HARIAN ke enum user_role

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'TUKANG_HARIAN';
