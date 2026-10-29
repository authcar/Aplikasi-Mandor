-- Jalankan di Supabase Studio > SQL Editor (project Aplikasi Mandor).
-- Butuh add_portal_klien.sql sudah dijalankan (tabel portal_proyek).
--
-- Sementara, daftar proyek di Laporan Harian Supervisor diambil dari proyek
-- tracker (Portal Klien: portal_proyek), bukan dari Taraco. Laporan, foto,
-- Man Power, dan PDF tetap terikat ke tabel `proyek`, jadi tiap proyek tracker
-- disalin ke `proyek` (lib/laporanProyek.js) dengan portal_id sebagai kunci.
-- Salinan itu is_active = false supaya tidak muncul di halaman lain (Absensi,
-- Lembur, daftar proyek Master/Finance) dan tidak disentuh sinkronisasi Taraco.
alter table proyek add column if not exists portal_id uuid unique references portal_proyek(id) on delete set null;
