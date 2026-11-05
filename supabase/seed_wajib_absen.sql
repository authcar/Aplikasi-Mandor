-- Jalankan SETELAH add_absensi_pegawai.sql.
--
-- Menandai akun mana yang wajib absen (kartu "Absensi Saya" hanya muncul untuk
-- akun yang wajib_absen = true). Daftar bisa diubah kapan saja: tambah email
-- baru lalu jalankan ulang, atau matikan satu akun dengan
--   update profiles set wajib_absen = false where lower(email) = '...';
--
-- Kolom profiles.email diisi oleh add_profiles_email.sql. Setelah dijalankan,
-- cek hasilnya — 12 baris untuk 12 email:
--   select name, email, role from profiles where wajib_absen order by name;
-- Email yang tidak muncul berarti belum punya akun / emailnya beda ketik.

update profiles
set wajib_absen = true
where lower(email) in (
  'septianda139@gmail.com',
  'taraco.hilal@gmail.com',
  'ariiq.fawwazi@gmail.com',
  'kevinbrata02@gmail.com',
  'irfansyahputra232@gmail.com',
  'sriherdianti22@gmail.com',
  'keziastefania03@gmail.com',
  'nbilahamiroh@gmail.com',
  'ilysmch12@gmail.com',
  'basselimam03@gmail.com',
  'agung.suherman1414@gmail.com',
  'authcar@gmail.com'
);
