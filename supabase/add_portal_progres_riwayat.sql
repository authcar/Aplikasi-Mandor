-- Portal Klien: riwayat perubahan progres tahap, untuk laporan mingguan
-- (progres sebelum/sesudah per 7 hari, tahap yang dikerjakan, dan upah jasa
-- tukang per tim). portal_progres hanya menyimpan keadaan TERAKHIR, jadi tiap
-- perubahan (termasuk pembatalan = persen 0) dicatat juga di sini.
-- Baris portal_progres yang sudah ada disalin sekali sebagai titik awal.
-- Butuh add_portal_progres_persen.sql sudah dijalankan.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

create table if not exists portal_progres_riwayat (
  id        bigint generated always as identity primary key,
  proyek_id uuid not null references portal_proyek(id) on delete cascade,
  item_id   uuid not null references portal_item(id) on delete cascade,
  tahap     text not null,
  persen    numeric(5,2) not null check (persen >= 0 and persen <= 100),
  tgl       date not null,
  oleh      uuid references profiles(id) on delete set null,
  at        timestamptz not null default now()
);
create index if not exists idx_portal_progres_riwayat_proyek on portal_progres_riwayat(proyek_id, tgl);
create index if not exists idx_portal_progres_riwayat_item on portal_progres_riwayat(item_id, tahap);

alter table portal_progres_riwayat enable row level security;

insert into portal_progres_riwayat (proyek_id, item_id, tahap, persen, tgl, oleh, at)
select i.proyek_id, p.item_id, p.tahap, p.persen, p.selesai_tgl, p.dicatat_oleh, p.dicatat_at
from portal_progres p
join portal_item i on i.id = p.item_id
where not exists (
  select 1 from portal_progres_riwayat r where r.item_id = p.item_id and r.tahap = p.tahap
);

notify pgrst, 'reload schema';
