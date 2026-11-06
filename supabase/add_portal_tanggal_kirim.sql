-- Tanggal pengiriman proyek (label di Portal Klien). Diisi admin/master di tab
-- Info proyek; dilihat staf termasuk Head of Production (di beranda /hop dan
-- halaman proyek). Tidak ditampilkan ke klien.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_proyek add column if not exists tanggal_kirim date;

notify pgrst, 'reload schema';
