-- Portal Klien: nominal pembayaran termin + pilihan penimbang progres.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang
-- (pengisian awal hanya terjadi saat kolomnya baru dibuat).
--
-- portal_termin.dibayar
--   Nominal yang benar-benar diterima untuk termin itu (boleh sebagian).
--   Dikunci saat termin ditandai lunas, supaya "Sudah dibayar" tidak ikut
--   berubah kalau harga item diubah belakangan. Termin yang sudah lunas diisi
--   dengan nominal yang selama ini tampil (persen x jumlah harga item).
--
-- portal_proyek.timbang_harga
--   true  = progres proyek ditimbang harga item (kalau semua item berharga).
--   false = ditimbang bobot item.
--   Dipilih admin di tab Item BOQ. Proyek yang semua itemnya sudah berharga
--   diisi true, supaya angka progresnya tidak berubah oleh pembaruan ini.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'portal_termin' and column_name = 'dibayar'
  ) then
    alter table portal_termin add column dibayar numeric(14,0) check (dibayar >= 0);

    update portal_termin t
    set dibayar = round(t.persen / 100 * s.total)
    from (select proyek_id, sum(harga) as total from portal_item group by proyek_id) s
    where s.proyek_id = t.proyek_id and t.lunas_tgl is not null and s.total > 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'portal_proyek' and column_name = 'timbang_harga'
  ) then
    alter table portal_proyek add column timbang_harga boolean not null default false;

    update portal_proyek p
    set timbang_harga = true
    where exists (select 1 from portal_item i where i.proyek_id = p.id)
      and not exists (select 1 from portal_item i where i.proyek_id = p.id and coalesce(i.harga, 0) <= 0);
  end if;
end $$;

-- Supaya API Supabase langsung mengenali kolom baru.
notify pgrst, 'reload schema';
