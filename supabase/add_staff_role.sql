-- Jalankan di Supabase Studio > SQL Editor — JALANKAN BLOK INI SENDIRIAN.
--
-- Role baru STAFF: akun terbatas, dashboard sendiri (/staff) hanya berisi
-- absensi pegawai, tombol Project Tracker (/portal, sebagai Admin), dan profil
-- (ubah sandi).
--
-- Tidak ada perubahan RLS: STAFF tidak masuk ke policy tabel mana pun, jadi
-- role ini tidak membuka data Supabase lain. Absensi memakai /api/absensi-pegawai
-- (service role) dan Project Tracker membaca lewat server.
--
-- ALTER TYPE ... ADD VALUE tidak bisa dipakai di transaksi yang sama dengan
-- penggunaannya, jadi jalankan blok pertama ini SENDIRI lebih dulu, baru blok
-- kedua (pindah role) sesudah blok pertama selesai.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STAFF';

-- ---------------------------------------------------------------------
-- Blok kedua (jalankan terpisah, setelah blok pertama): pindahkan Ariq
-- Fawwazi dari FINANCE ke STAFF. wajib_absen tetap true.
-- ---------------------------------------------------------------------
-- update profiles set role = 'STAFF' where lower(email) = 'ariiq.fawwazi@gmail.com';
