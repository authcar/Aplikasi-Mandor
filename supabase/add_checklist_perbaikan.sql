-- Jalankan di Supabase Studio > SQL Editor
-- Fitur: Checklist Perbaikan (defect list) — Supervisor lapor defect ke Mandor proyek.

create table checklist_perbaikan (
  id             uuid primary key default gen_random_uuid(),
  proyek_id      uuid not null references proyek(id) on delete cascade,
  no             int not null,
  uraian         text not null,               -- uraian pekerjaan perapihan
  foto_url       text,                        -- bucket 'perbaikan'
  periode        text,
  status         status_mslh not null default 'OPEN',
  dibaca_mandor  boolean not null default false, -- untuk notifikasi "baru" ke mandor
  created_by     uuid not null references profiles(id), -- supervisor/pengawas
  selesai_at     timestamptz,
  created_at     timestamptz default now()
);
create index idx_checklist_proyek on checklist_perbaikan(proyek_id);

alter table checklist_perbaikan enable row level security;

-- Sama seperti pola MASALAH: siapa saja yang terlibat di proyek (mandor/supervisor) boleh baca & tulis.
create policy checklist_rw on checklist_perbaikan for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()));

-- Storage bucket foto dokumentasi perbaikan
insert into storage.buckets (id, name, public)
values ('perbaikan', 'perbaikan', false)
on conflict (id) do nothing;

-- Perluas policy storage yang sudah ada supaya mencakup bucket 'perbaikan'
drop policy if exists storage_read on storage.objects;
create policy storage_read on storage.objects for select
  using (bucket_id in ('progres','nota','masalah','perbaikan')
         and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()));

drop policy if exists storage_write on storage.objects;
create policy storage_write on storage.objects for insert
  with check (bucket_id in ('progres','nota','masalah','perbaikan')
         and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()));
