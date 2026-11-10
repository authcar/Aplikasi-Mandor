-- Project Tracker (portal) otomatis menarik proyek dari Taraco Project Management:
-- begitu sebuah proyek masuk stage "DP / SPK" (pipeline MASTER) ia dibuatkan
-- baris di portal_proyek (lib/portal/syncTaraco.js).
-- Jalankan sekali di Supabase Studio > SQL Editor project Aplikasi Mandor
-- (BUKAN project Taraco). Aman dijalankan ulang.

-- taraco_id = kunci idempoten: satu proyek Taraco hanya membuat satu proyek portal.
alter table portal_proyek add column if not exists taraco_id uuid unique;

-- Proyek portal yang dihapus admin dicatat di sini supaya sinkron tidak
-- membuatnya lagi selama proyek itu masih di stage yang sama di Taraco.
create table if not exists portal_taraco_lewat (
  taraco_id  uuid primary key,
  created_at timestamptz not null default now()
);
alter table portal_taraco_lewat enable row level security;

notify pgrst, 'reload schema';
