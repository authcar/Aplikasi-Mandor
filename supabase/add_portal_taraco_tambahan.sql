-- Satu proyek Tracker bisa mengirim progres ke LEBIH DARI SATU kartu Taraco
-- (mis. proyek yang sama tercatat di beberapa kartu / board). Kartu utama tetap
-- portal_proyek.taraco_id; kartu tambahan dicatat di sini.
-- Jalankan sekali di Supabase SQL Editor project Aplikasi Mandor (BUKAN Taraco). Aman dijalankan ulang.
create table if not exists portal_taraco_tambahan (
  taraco_id  uuid primary key,
  proyek_id  uuid not null references portal_proyek(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table portal_taraco_tambahan enable row level security;

notify pgrst, 'reload schema';
