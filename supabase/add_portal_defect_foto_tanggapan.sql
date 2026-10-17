-- Portal Klien: foto di tanggapan tim untuk defect dari klien (mis. foto
-- sesudah diperbaiki). Path di bucket 'portal-defect' yang sama dengan foto
-- laporan klien. Butuh supabase/add_portal_defect.sql sudah dijalankan.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_defect
  add column if not exists foto_tanggapan text[] not null default '{}';
