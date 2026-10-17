-- Portal Klien: defect list dari klien.
-- Klien (tanpa login, lewat link /k/[token]) bisa mengirim keluhan tentang
-- proyek/itemnya: keterangan + foto. Admin & supervisor menanggapi di tab
-- Defect halaman proyek: status BARU -> DIPROSES -> SELESAI + tanggapan
-- yang ikut tampil di halaman klien.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- Sama seperti tabel portal_* lain: dibaca/ditulis HANYA dari server memakai
-- service role. RLS menyala tanpa policy, jadi akses langsung dari browser ditolak.

create table if not exists portal_defect (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references portal_proyek(id) on delete cascade,
  item_id     uuid references portal_item(id) on delete set null,  -- opsional
  keterangan  text not null,
  pelapor     text,                                  -- nama di link klien
  foto        text[] not null default '{}',          -- path di bucket 'portal-defect'
  status      text not null default 'BARU' check (status in ('BARU', 'DIPROSES', 'SELESAI')),
  tanggapan   text,                                  -- dari tim, tampil ke klien
  diubah_oleh uuid references profiles(id) on delete set null,
  diubah_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_portal_defect_proyek on portal_defect(proyek_id, created_at desc);

alter table portal_defect enable row level security;

-- Foto defect: bucket privat. Diunggah & ditampilkan lewat server (signed URL),
-- jadi tidak perlu policy storage.
insert into storage.buckets (id, name, public)
values ('portal-defect', 'portal-defect', false)
on conflict (id) do nothing;
