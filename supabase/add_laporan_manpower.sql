-- Jalankan di Supabase Studio > SQL Editor.
-- Man Power harian per proyek (tabel MAN POWER di PDF Daily Progress), diisi
-- Supervisor di halaman Laporan Harian. Satu baris = satu klasifikasi tim
-- pada satu proyek di satu hari.

create table if not exists laporan_manpower (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references proyek(id) on delete cascade,
  tanggal     date not null default current_date,
  klasifikasi text not null,
  aktif_site  integer not null default 0 check (aktif_site >= 0),
  aktif_ws    integer not null default 0 check (aktif_ws >= 0),
  lembur      integer not null default 0 check (lembur >= 0),
  alpha       integer not null default 0 check (alpha >= 0),
  created_by  uuid references profiles(id),
  updated_at  timestamptz default now(),
  unique (proyek_id, tanggal, klasifikasi)
);
create index if not exists idx_laporan_manpower_proyek_tgl on laporan_manpower(proyek_id, tanggal desc);

alter table laporan_manpower enable row level security;

-- Baca: siapa pun yang terkait proyeknya, plus Master & Finance (data lintas proyek).
drop policy if exists laporan_manpower_read on laporan_manpower;
create policy laporan_manpower_read on laporan_manpower for select
  using (proyek_id in (select my_proyek_ids()) or my_role() in ('MASTER', 'FINANCE'));

-- Tulis: Supervisor proyek tsb atau Master.
drop policy if exists laporan_manpower_write on laporan_manpower;
create policy laporan_manpower_write on laporan_manpower for all
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() = 'MASTER'
  )
  with check (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() = 'MASTER'
  );
