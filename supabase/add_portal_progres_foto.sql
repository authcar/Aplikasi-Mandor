-- Portal Klien: foto progres per item BOQ (diunggah supervisor/admin di tab
-- Progres, boleh banyak foto per item). Foto disimpan di bucket privat
-- 'portal-progres' dan ditampilkan lewat signed URL di halaman staf. Untuk
-- sementara TIDAK ditampilkan ke klien (lihat FOTO_PROGRES_KLIEN di
-- lib/portal/format.js).
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

create table if not exists portal_progres_foto (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references portal_proyek(id) on delete cascade,
  item_id     uuid not null references portal_item(id) on delete cascade,
  path        text not null,
  dicatat_oleh uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_portal_progres_foto_proyek on portal_progres_foto(proyek_id, created_at);
create index if not exists idx_portal_progres_foto_item on portal_progres_foto(item_id);

alter table portal_progres_foto enable row level security;

insert into storage.buckets (id, name, public)
values ('portal-progres', 'portal-progres', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
