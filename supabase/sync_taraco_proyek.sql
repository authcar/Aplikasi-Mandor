-- Jalankan manual di SQL Editor project Supabase Aplikasi Mandor
-- (rmkocokczeiixcgayzfr) — BUKAN di project Taraco.
--
-- proyek jadi read-only mirror dari Taraco (tabel `projects`), disinkronkan
-- otomatis lewat lib/supabase/syncProyek.js. taraco_id = kunci upsert
-- idempoten. supervisor_id dilonggarkan jadi nullable karena pencocokan
-- nama mandor/supervisor dari Taraco ke akun profil bisa gagal.

alter table proyek add column if not exists taraco_id uuid unique;
alter table proyek alter column supervisor_id drop not null;

-- Proyek lokal lama yang bukan hasil sync Taraco: sembunyikan dari
-- dashboard (bukan dihapus — histori absensi/lembur/keuangan tetap ada).
update proyek set is_active = false where taraco_id is null;
