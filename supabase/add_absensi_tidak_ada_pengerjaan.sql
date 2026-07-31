-- Tombol "Tidak Ada Pengerjaan Hari Ini" di halaman absensi tukang harian
-- (app/tukang-harian/absensi). Saat dipilih, hari itu ditandai di
-- absensi_ringkas.tidak_ada_pengerjaan = true dan jumlah_hadir dipaksa 0,
-- supaya kartu "Hadir Hari Ini" di app/supervisor/proyek/[id] tidak
-- menghitungnya sebagai absensi (ditampilkan sebagai "Tidak ada pengerjaan"
-- alih-alih "0 orang").
alter table absensi_ringkas
  add column if not exists tidak_ada_pengerjaan boolean not null default false;
