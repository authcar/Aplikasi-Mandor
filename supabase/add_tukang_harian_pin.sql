-- Jalankan di Supabase Studio > SQL Editor
-- Tambah PIN rahasia untuk login tukang harian, supaya login tidak lagi
-- bisa dibobol hanya dengan menebak/mengetahui nomor HP orang lain.
--
-- PIN diisi MANUAL oleh mandor/supervisor saat akun tukang harian dibuat
-- (atau untuk akun yang sudah ada), lewat:
--   update profiles set pin = '1234' where id = '<uuid user>';
-- PIN harus 4 digit angka, dan sebaiknya TIDAK sama dengan potongan nomor
-- HP pemiliknya (supaya tidak mudah ditebak).

alter table profiles add column if not exists pin text;

alter table profiles drop constraint if exists profiles_pin_format;
alter table profiles add constraint profiles_pin_format
  check (pin is null or pin ~ '^[0-9]{4}$');

-- Cek akun tukang harian yang BELUM punya PIN (harus di-set manual
-- sebelum mereka bisa login lagi setelah migrasi ini dijalankan):
--   select id, name, phone from profiles where role = 'TUKANG_HARIAN' and pin is null;
