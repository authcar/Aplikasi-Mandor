-- Deadline proyek, disinkron dari Taraco (projects.due_date) lewat
-- syncProyekFromTaraco (lib/supabase/syncProyek.js). Dipakai untuk sort
-- "Proyek Saya" di dashboard Supervisor berdasarkan deadline terdekat dan
-- menampilkan label deadline per proyek.
alter table proyek
  add column if not exists deadline date;
