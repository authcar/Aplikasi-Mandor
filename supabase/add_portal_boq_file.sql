-- Portal Klien: simpan file BoQ (Excel) asli per proyek.
-- File diunggah admin saat impor BoQ (atau manual di halaman proyek), disimpan di
-- bucket privat 'portal-boq', dan hanya admin yang bisa mengunduhnya (isinya bisa memuat harga).
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_proyek
  add column if not exists boq_file text,
  add column if not exists boq_file_nama text,
  add column if not exists boq_file_at timestamptz;

insert into storage.buckets (id, name, public)
values ('portal-boq', 'portal-boq', false)
on conflict (id) do nothing;
