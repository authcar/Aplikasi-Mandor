-- Jalankan di Supabase Studio > SQL Editor
-- Tambah jam absen masuk supaya bisa ditampilkan (kartu Absensi Saya: Masuk/Pulang/Total Jam)
-- dan dipakai untuk feedback "tepat waktu" / "telat".

alter table checkin_harian add column if not exists checkin_at timestamptz;
