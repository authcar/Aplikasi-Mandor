-- Jalankan di Supabase Studio > SQL Editor
-- Izinkan Mandor/Supervisor/Master melihat profil TUKANG_HARIAN yang ada di
-- proyek yang bisa mereka akses (my_proyek_ids()) — dibutuhkan oleh halaman
-- "Tukang Harian" (list + tambah + reset PIN) di /mandor dan /supervisor.
-- Sebelum ini, profiles_self hanya mengizinkan lihat diri sendiri (+ supervisor
-- lihat mandor di proyeknya), jadi list tukang harian akan selalu kosong.

drop policy if exists profiles_list_tukang_harian on profiles;
create policy profiles_list_tukang_harian on profiles for select
  using (role = 'TUKANG_HARIAN' and proyek_id in (select my_proyek_ids()));
