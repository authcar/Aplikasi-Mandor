-- Jalankan di Supabase Studio > SQL Editor.
-- Koreksi laporan harian (edit & hapus kegiatan):
--   Supervisor -> hanya laporannya sendiri, dan hanya di hari yang sama
--                 (hari = tanggal WIB saat laporan dibuat).
--   Master     -> semua laporan, kapan saja.
-- Policy UPDATE lama (laporan_harian_update: MASTER/FINANCE, dipakai untuk
-- menandai dibaca_master) tidak diubah; policy di bawah ini ADDITIVE.

drop policy if exists laporan_harian_update_spv on laporan_harian;
create policy laporan_harian_update_spv on laporan_harian for update
  using (
    my_role() = 'SUPERVISOR'
    and created_by = auth.uid()
    and (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
  )
  with check (
    my_role() = 'SUPERVISOR'
    and created_by = auth.uid()
    and proyek_id in (select my_proyek_ids())
  );

drop policy if exists laporan_harian_update_master on laporan_harian;
create policy laporan_harian_update_master on laporan_harian for update
  using (my_role() = 'MASTER')
  with check (my_role() = 'MASTER');

drop policy if exists laporan_harian_delete on laporan_harian;
create policy laporan_harian_delete on laporan_harian for delete
  using (
    my_role() = 'MASTER'
    or (
      my_role() = 'SUPERVISOR'
      and created_by = auth.uid()
      and (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
    )
  );
