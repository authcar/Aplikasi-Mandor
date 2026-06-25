-- =====================================================================
-- APLIKASI MANDOR — Supabase Schema + RLS
-- Jalankan di Supabase Studio > SQL Editor (sekali jalan).
-- =====================================================================

-- ---------- ENUM ----------
create type user_role   as enum ('MANDOR', 'SUPERVISOR');
create type status_apr  as enum ('PENDING', 'APPROVED', 'REJECTED');
create type jenis_uang  as enum ('KASBON', 'REIMBURSE');
create type status_mslh as enum ('OPEN', 'IN_PROGRESS', 'DONE');

-- ---------- PROFILES (terhubung ke auth.users) ----------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       user_role not null default 'MANDOR',
  phone      text,
  created_at timestamptz default now()
);

-- ---------- PROYEK ----------
-- supervisor_id: 1 supervisor membawahi banyak proyek
-- mandor_id    : 1 mandor memegang proyek
create table proyek (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,
  lokasi        text,
  supervisor_id uuid not null references profiles(id),
  mandor_id     uuid references profiles(id),
  is_active     boolean default true,
  created_at    timestamptz default now()
);
create index idx_proyek_supervisor on proyek(supervisor_id);
create index idx_proyek_mandor on proyek(mandor_id);

-- ---------- TUKANG (pekerja di bawah mandor/proyek) ----------
create table tukang (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references proyek(id) on delete cascade,
  nama        text not null,
  jabatan     text default 'Tukang',           -- Tukang / Kenek / Kepala
  upah_harian numeric(12,0) not null default 0, -- Rupiah, tanpa desimal
  is_active   boolean default true,
  created_at  timestamptz default now()
);
create index idx_tukang_proyek on tukang(proyek_id);

-- ---------- ABSENSI (roll-call harian) ----------
create table absensi (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  tukang_id  uuid not null references tukang(id) on delete cascade,
  tanggal    date not null default current_date,
  hadir      boolean not null default true,
  upah_snap  numeric(12,0) not null default 0, -- snapshot upah saat absen
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  unique (tukang_id, tanggal)                  -- 1 tukang 1x per hari
);
create index idx_absensi_proyek_tgl on absensi(proyek_id, tanggal);

-- ---------- FOTO PROGRES HARIAN (foto borongan suasana) ----------
create table progres_foto (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  tanggal    date not null default current_date,
  foto_url   text not null,                    -- path di storage bucket 'progres'
  catatan    text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index idx_progres_proyek_tgl on progres_foto(proyek_id, tanggal);

-- ---------- LEMBUR ----------
create table lembur (
  id           uuid primary key default gen_random_uuid(),
  proyek_id    uuid not null references proyek(id) on delete cascade,
  tukang_id    uuid not null references tukang(id) on delete cascade,
  tanggal      date not null default current_date,
  jam          numeric(4,1) not null,          -- jumlah jam lembur
  tarif_per_jam numeric(12,0) not null default 0,
  total        numeric(12,0) generated always as (jam * tarif_per_jam) stored,
  status       status_apr not null default 'PENDING',
  catatan      text,
  created_by   uuid not null references profiles(id), -- mandor
  reviewed_by  uuid references profiles(id),          -- supervisor
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);
create index idx_lembur_proyek_status on lembur(proyek_id, status);

-- ---------- KEUANGAN (Kasbon + Reimburse jadi satu) ----------
create table keuangan (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references proyek(id) on delete cascade,
  tukang_id   uuid references tukang(id),       -- null utk reimburse umum
  jenis       jenis_uang not null,             -- KASBON | REIMBURSE
  nominal     numeric(12,0) not null,
  keterangan  text,
  nota_url    text,                            -- bucket 'nota' (utk reimburse)
  status      status_apr not null default 'PENDING',
  created_by  uuid not null references profiles(id),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz default now()
);
create index idx_keuangan_proyek_status on keuangan(proyek_id, status);

-- ---------- MASALAH / KENDALA LAPANGAN ----------
create table masalah (
  id         uuid primary key default gen_random_uuid(),
  proyek_id  uuid not null references proyek(id) on delete cascade,
  judul      text not null,
  deskripsi  text,
  foto_url   text,                             -- bucket 'masalah'
  status     status_mslh not null default 'OPEN',
  created_by uuid not null references profiles(id),
  created_at timestamptz default now()
);
create index idx_masalah_proyek on masalah(proyek_id);

-- =====================================================================
-- HELPER: ambil role user yang sedang login (hindari rekursi RLS)
-- =====================================================================
create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- proyek_id mana saja yang boleh diakses user ini?
create or replace function my_proyek_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from proyek
  where mandor_id = auth.uid() or supervisor_id = auth.uid()
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Aturan inti:
--   MANDOR     -> hanya proyek yg mandor_id = dirinya
--   SUPERVISOR -> semua proyek yg supervisor_id = dirinya
--   Approval (status) hanya boleh diubah SUPERVISOR
-- =====================================================================
alter table profiles     enable row level security;
alter table proyek       enable row level security;
alter table tukang       enable row level security;
alter table absensi      enable row level security;
alter table progres_foto enable row level security;
alter table lembur       enable row level security;
alter table keuangan     enable row level security;
alter table masalah      enable row level security;

-- PROFILES: lihat diri sendiri + supervisor bisa lihat profil mandor di proyeknya
create policy profiles_self on profiles for select
  using (id = auth.uid()
         or exists (select 1 from proyek p
                    where p.supervisor_id = auth.uid() and p.mandor_id = profiles.id));
create policy profiles_update_self on profiles for update
  using (id = auth.uid());
-- Supervisor boleh melihat semua MANDOR (untuk ditugaskan ke proyek)
create policy profiles_list_mandor on profiles for select
  using (my_role() = 'SUPERVISOR' and role = 'MANDOR');

-- PROYEK: hanya proyek milik user (mandor/supervisor)
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid() or supervisor_id = auth.uid());
create policy proyek_write on proyek for all
  using (supervisor_id = auth.uid())            -- hanya supervisor kelola proyek
  with check (supervisor_id = auth.uid());

-- TUKANG: hanya tukang dari proyek yang boleh diakses
create policy tukang_rw on tukang for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()));

-- ABSENSI: read sesuai proyek; insert/update hanya mandor proyek tsb
create policy absensi_read on absensi for select
  using (proyek_id in (select my_proyek_ids()));
create policy absensi_write on absensi for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());
create policy absensi_update on absensi for update
  using (proyek_id in (select my_proyek_ids()));

-- PROGRES FOTO
create policy progres_read on progres_foto for select
  using (proyek_id in (select my_proyek_ids()));
create policy progres_write on progres_foto for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());

-- LEMBUR: semua pihak proyek bisa baca; mandor insert; HANYA supervisor ubah status
create policy lembur_read on lembur for select
  using (proyek_id in (select my_proyek_ids()));
create policy lembur_insert on lembur for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());
create policy lembur_review on lembur for update
  using (my_role() = 'SUPERVISOR'
         and proyek_id in (select id from proyek where supervisor_id = auth.uid()));

-- KEUANGAN: sama polanya dgn lembur
create policy keuangan_read on keuangan for select
  using (proyek_id in (select my_proyek_ids()));
create policy keuangan_insert on keuangan for insert
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());
create policy keuangan_review on keuangan for update
  using (my_role() = 'SUPERVISOR'
         and proyek_id in (select id from proyek where supervisor_id = auth.uid()));

-- MASALAH
create policy masalah_read on masalah for select
  using (proyek_id in (select my_proyek_ids()));
create policy masalah_write on masalah for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()));

-- =====================================================================
-- AUTO-CREATE PROFILE saat user baru daftar
-- =====================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'MANDOR'));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- STORAGE BUCKETS (foto progres, nota, masalah) — private
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('progres','progres',false), ('nota','nota',false), ('masalah','masalah',false)
on conflict (id) do nothing;

-- Akses storage: user boleh baca/tulis file di proyek yang ia akses.
-- Konvensi path file: '<proyek_id>/<nama_file>'
create policy storage_read on storage.objects for select
  using (bucket_id in ('progres','nota','masalah')
         and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()));
create policy storage_write on storage.objects for insert
  with check (bucket_id in ('progres','nota','masalah')
         and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()));
