-- Jalankan manual di SQL Editor project Supabase Aplikasi Mandor.
--
-- Bug: laporan_harian_read & laporan_harian_insert sudah ada
-- (add_laporan_harian.sql), tapi TIDAK ADA policy UPDATE. Master/Finance
-- gagal menandai dibaca_master = true saat buka halaman Laporan Harian
-- (app/master/laporan-harian/page.jsx & app/finance/laporan-harian/page.jsx)
-- — UPDATE-nya jalan tanpa error tapi 0 baris berubah karena RLS menolak
-- diam-diam. Akibatnya badge notifikasi jumlah laporan baru nempel terus
-- walau halamannya sudah dibuka.

drop policy if exists laporan_harian_update on laporan_harian;
create policy laporan_harian_update on laporan_harian for update
  using (my_role() in ('MASTER', 'FINANCE'))
  with check (my_role() in ('MASTER', 'FINANCE'));
