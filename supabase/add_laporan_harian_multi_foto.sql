-- Jalankan di SQL Editor project Supabase Aplikasi Mandor.
--
-- Laporan Harian: satu kegiatan boleh punya BANYAK foto dokumentasi.
-- foto_urls = daftar path di bucket 'progres' (urutan = urutan di PDF).
-- foto_url (kolom lama) tetap diisi foto PERTAMA supaya semua tampilan lama
-- (thumbnail riwayat, dll.) tetap jalan tanpa diubah.

alter table laporan_harian add column if not exists foto_urls text[] not null default '{}';

-- Laporan lama: satu foto yang sudah ada jadi isi pertama daftar.
update laporan_harian
   set foto_urls = array[foto_url]
 where foto_url is not null
   and cardinality(foto_urls) = 0;
