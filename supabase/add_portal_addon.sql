-- Portal Klien: addons / penambahan biaya di luar nilai proyek awal.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_addon
--   Satu baris = satu penambahan biaya (mis. tambah lemari, ganti material).
--   Ditagih terpisah dari termin: lunas_tgl terisi = sudah diterima penuh.
--   Hanya admin yang melihatnya (lewat server, seperti tabel portal_* lain).

create table if not exists portal_addon (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references portal_proyek(id) on delete cascade,
  nama       text not null,
  nilai      numeric(14,0) not null check (nilai >= 0),
  lunas_tgl  date,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_addon_proyek on portal_addon(proyek_id, created_at);

alter table portal_addon enable row level security;

-- Supaya API Supabase langsung mengenali tabel baru.
notify pgrst, 'reload schema';
