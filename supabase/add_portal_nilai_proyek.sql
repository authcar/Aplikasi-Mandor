-- Portal Klien (Project Tracker): nilai proyek ke klien.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_proyek.nilai_proyek
--   Nilai proyek yang ditagihkan ke klien, diisi admin di tab Termin.
--   Dasar tagihan tiap termin (persen x nilai_proyek) dan "Total nilai proyek"
--   di halaman klien. Terpisah dari nilai jasa tukang per item (portal_item.harga).

alter table portal_proyek add column if not exists nilai_proyek numeric(14,0) check (nilai_proyek >= 0);

-- Supaya API Supabase langsung mengenali kolom baru.
notify pgrst, 'reload schema';
