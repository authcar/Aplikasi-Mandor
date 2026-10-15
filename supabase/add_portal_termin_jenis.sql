-- Portal Klien: termin dibagi dua, jasa perancangan dan jasa produksi.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_proyek.nilai_perancangan
--   Harga jasa perancangan ke klien. Kosong = proyek tanpa jasa perancangan.
--   Nilai jasa produksi tetap = jumlah harga item BOQ.
--
-- portal_termin.jenis
--   'perancangan' -> tagihan = persen x nilai_perancangan
--   'produksi'    -> tagihan = persen x jumlah harga item
--   Termin yang sudah ada dianggap termin produksi.
--
-- Pola standar (lib/portal/format.js):
--   perancangan < Rp 10 jt : 50 / 40 / 10
--   perancangan >= Rp 10 jt: 40 / 30 / 20 / 10
--   produksi               : DP 50 / progres 50% 40 / pelunasan 10

alter table portal_proyek add column if not exists nilai_perancangan numeric(14,0) check (nilai_perancangan >= 0);

alter table portal_termin add column if not exists jenis text not null default 'produksi';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portal_termin_jenis_check') then
    alter table portal_termin add constraint portal_termin_jenis_check check (jenis in ('perancangan', 'produksi'));
  end if;
end $$;

drop index if exists idx_portal_termin_proyek;
create index if not exists idx_portal_termin_proyek on portal_termin(proyek_id, jenis, urutan);

-- Supaya API Supabase langsung mengenali kolom baru.
notify pgrst, 'reload schema';
