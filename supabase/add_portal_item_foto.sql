-- Portal Klien: foto contoh per item BOQ (kolom C template BoQ).
-- Foto diunggah saat impor Excel, disimpan di bucket privat 'portal-item', dan
-- ditampilkan lewat signed URL di halaman klien (tombol "Foto" tiap item).
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_item
  add column if not exists foto text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('portal-item', 'portal-item', false)
on conflict (id) do nothing;
