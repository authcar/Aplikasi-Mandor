-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_biaya_proyek.sql.
--
-- Master boleh LIHAT saja data Pos Biaya / Biaya & Profit Proyek — semua
-- input/ubah/hapus tetap eksklusif role FINANCE (kebijakan *_finance_rw
-- di add_biaya_proyek.sql tidak berubah). Postgres RLS: beberapa policy
-- permissive untuk command yang sama (select) digabung dengan OR, jadi
-- ini murni menambah akses baca, tidak mengurangi apa pun.

drop policy if exists pos_biaya_master_read on pos_biaya;
create policy pos_biaya_master_read on pos_biaya for select
  using (my_role() = 'MASTER');

drop policy if exists biaya_proyek_master_read on biaya_proyek;
create policy biaya_proyek_master_read on biaya_proyek for select
  using (my_role() = 'MASTER');

drop policy if exists penerimaan_proyek_master_read on penerimaan_proyek;
create policy penerimaan_proyek_master_read on penerimaan_proyek for select
  using (my_role() = 'MASTER');
