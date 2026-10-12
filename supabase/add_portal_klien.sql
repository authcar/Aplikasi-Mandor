-- Portal Klien: progres BOQ per proyek + link rahasia untuk klien (/k/[token]).
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- Proyek portal SENGAJA terpisah dari tabel `proyek` (yang disinkron dari
-- Taraco): dibuat manual oleh MASTER di /portal.
--
-- Hak akses:
--   MASTER     -> semua proyek portal: buat proyek, impor BOQ, termin, link klien.
--   SUPERVISOR -> hanya proyek yang supervisor_id = dirinya: centang tahap.
--   Klien      -> tanpa login, lewat token di portal_link.
--
-- Semua tabel di bawah dibaca/ditulis HANYA dari server memakai service role
-- (lib/portal/), dan hak akses dicek di sana. RLS dinyalakan tanpa policy,
-- jadi akses langsung dari browser (anon/authenticated) ditolak seluruhnya.

create table if not exists portal_proyek (
  id            uuid primary key default gen_random_uuid(),
  kode          text,
  nama          text not null,
  lokasi        text,
  klien_nama    text,
  mulai         date not null default (now() at time zone 'Asia/Jakarta')::date,
  deadline      date,
  supervisor_id uuid references profiles(id) on delete set null,
  aktif         boolean not null default true,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_portal_proyek_supervisor on portal_proyek(supervisor_id);

create table if not exists portal_item (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references portal_proyek(id) on delete cascade,
  area        text not null default 'Umum',
  kode        text,
  nama        text not null,
  jenis       text not null default 'HPL' check (jenis in ('HPL', 'DUCO', 'VENDOR', 'SIPIL')),
  qty         numeric(10,2) not null default 1,
  satuan      text,
  dimensi     text,
  harga       numeric(14,0),               -- nilai total item ke klien; boleh kosong dulu
  bobot       numeric(8,2) not null default 1 check (bobot > 0),
  urutan      int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_portal_item_proyek on portal_item(proyek_id, urutan);

-- Daftar tahap & bobot per jenis ada di lib/portal/progresBoq.js.
create table if not exists portal_progres (
  item_id      uuid not null references portal_item(id) on delete cascade,
  tahap        text not null,
  selesai_tgl  date not null,
  dicatat_oleh uuid references profiles(id) on delete set null,
  dicatat_at   timestamptz not null default now(),
  primary key (item_id, tahap)
);

create table if not exists portal_termin (
  id          uuid primary key default gen_random_uuid(),
  proyek_id   uuid not null references portal_proyek(id) on delete cascade,
  urutan      int not null default 0,
  label       text not null,
  persen      numeric(5,2) not null check (persen > 0 and persen <= 100),
  jatuh_tempo date,
  lunas_tgl   date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_portal_termin_proyek on portal_termin(proyek_id, urutan);

-- Link rahasia klien. Siapa pun yang memegang token bisa melihat proyeknya;
-- mencabut link = menghapus barisnya.
create table if not exists portal_link (
  token      text primary key,
  proyek_id  uuid not null references portal_proyek(id) on delete cascade,
  nama       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_link_proyek on portal_link(proyek_id);

alter table portal_proyek  enable row level security;
alter table portal_item    enable row level security;
alter table portal_progres enable row level security;
alter table portal_termin  enable row level security;
alter table portal_link    enable row level security;
