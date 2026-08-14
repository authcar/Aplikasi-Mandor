-- Jalankan di Supabase Studio > SQL Editor, kapan saja SETELAH role FINANCE
-- sudah ada (add_finance_role.sql + add_finance_rls.sql).
--
-- Fitur "Pos Biaya": Finance mengelompokkan pengeluaran proyek ke pos
-- (mis. Beli Bahan, Jasa Tukang, Transport), input biaya per proyek per
-- pos, dan catat penerimaan dari klien per proyek — supaya bisa lihat
-- total biaya per pos dan profit/loss (penerimaan - biaya) per proyek.
-- Terpisah dari tabel `keuangan` (kasbon/reimburse lewat alur klaim
-- mandor/supervisor + approval) — ini pencatatan langsung oleh Finance,
-- tidak butuh approval.

create table if not exists pos_biaya (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null unique,
  is_active  boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);

create table if not exists biaya_proyek (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  pos_id     uuid not null references pos_biaya(id),
  nominal    numeric(14,0) not null,
  keterangan text,
  tanggal    date not null default current_date,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_biaya_proyek_proyek on biaya_proyek(proyek_id);
create index if not exists idx_biaya_proyek_pos on biaya_proyek(pos_id);

create table if not exists penerimaan_proyek (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  nominal    numeric(14,0) not null,
  keterangan text,
  tanggal    date not null default current_date,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_penerimaan_proyek_proyek on penerimaan_proyek(proyek_id);

alter table pos_biaya         enable row level security;
alter table biaya_proyek      enable row level security;
alter table penerimaan_proyek enable row level security;

-- Ketiga tabel di atas khusus FINANCE (baca & tulis) — bukan MASTER/role
-- lain, sejalan dengan pemisahan wewenang budget di add_finance_role.sql
-- (my_role() didefinisikan di schema.sql).
drop policy if exists pos_biaya_finance_rw on pos_biaya;
create policy pos_biaya_finance_rw on pos_biaya for all
  using (my_role() = 'FINANCE')
  with check (my_role() = 'FINANCE');

drop policy if exists biaya_proyek_finance_rw on biaya_proyek;
create policy biaya_proyek_finance_rw on biaya_proyek for all
  using (my_role() = 'FINANCE')
  with check (my_role() = 'FINANCE');

drop policy if exists penerimaan_proyek_finance_rw on penerimaan_proyek;
create policy penerimaan_proyek_finance_rw on penerimaan_proyek for all
  using (my_role() = 'FINANCE')
  with check (my_role() = 'FINANCE');
