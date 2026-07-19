-- Jalankan di SQL Editor project Supabase Aplikasi Mandor.
--
-- Laporan Harian Supervisor: foto dokumentasi + deskripsi kegiatan + status
-- (Sedang Dikerjakan/Selesai/Perlu Perbaikan). Menggantikan tombol "Laporan
-- Harian" yang sebelumnya membuka bot Telegram (t.me/TaracoBot) — catatan:
-- sistem potongan gaji berbasis checkin_harian (diisi bot Telegram) TIDAK
-- otomatis ikut terisi dari laporan baru ini.

do $$ begin
  create type laporan_status as enum ('ON_PROGRESS', 'DONE', 'PERBAIKAN');
exception when duplicate_object then null;
end $$;

create table if not exists laporan_harian (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  tanggal    date not null default current_date,
  deskripsi  text not null,
  status     laporan_status not null default 'ON_PROGRESS',
  foto_url   text,                          -- path di storage bucket 'progres', nullable
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_laporan_harian_proyek_tgl on laporan_harian(proyek_id, tanggal desc);

alter table laporan_harian enable row level security;

drop policy if exists laporan_harian_read on laporan_harian;
create policy laporan_harian_read on laporan_harian for select
  using (proyek_id in (select my_proyek_ids()) or my_role() = 'MASTER');

drop policy if exists laporan_harian_insert on laporan_harian;
create policy laporan_harian_insert on laporan_harian for insert
  with check (
    proyek_id in (select my_proyek_ids())
    and created_by = auth.uid()
    and my_role() = 'SUPERVISOR'
  );
