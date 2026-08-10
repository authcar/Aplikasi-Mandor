-- Jalankan di Supabase Studio > SQL Editor.
--
-- Sebelumnya Google Drive cuma dipakai sebagai BACKUP (link Drive-nya tidak
-- pernah disimpan/ditampilkan, file di Supabase Storage baru dihapus 5 hari
-- kemudian lewat /api/drive-sync/cleanup). Sekarang begitu n8n konfirmasi
-- upload ke Drive sukses (/api/drive-sync/confirm), file ASLI langsung
-- dihapus dari Supabase Storage dan app menampilkan foto/video dari Google
-- Drive (lihat lib/perbaikanMedia.js) -- jadi butuh kolom buat simpan ID
-- file Drive-nya (bukan path storage lagi).
--
-- Simpan file ID (bukan URL utuh) supaya format link (thumbnail/view) bisa
-- diubah di satu tempat (lib/perbaikanMedia.js) tanpa migrasi ulang data.

alter table checklist_perbaikan_media add column if not exists drive_file_id text;
comment on column checklist_perbaikan_media.drive_file_id is
  'ID file Google Drive hasil upload n8n (diisi lewat /api/drive-sync/confirm). Begitu terisi, file aslinya SUDAH dihapus dari Supabase Storage (path jadi NULL) -- app menampilkan dari Drive.';

-- path dulu NOT NULL (selalu diisi saat upload) -- sekarang dikosongkan
-- begitu file sudah dipindah ke Drive, jadi constraint-nya harus dilonggarkan.
alter table checklist_perbaikan_media alter column path drop not null;

alter table checklist_perbaikan add column if not exists foto_drive_file_id text;
alter table checklist_perbaikan add column if not exists video_drive_file_id text;
alter table checklist_perbaikan add column if not exists foto_bukti_drive_file_id text;
alter table checklist_perbaikan add column if not exists video_bukti_drive_file_id text;
comment on column checklist_perbaikan.foto_drive_file_id is
  'Sama seperti checklist_perbaikan_media.drive_file_id, versi item LAMA (pra-migrasi multi-media). Begitu terisi, foto_url dikosongkan (file sudah dihapus dari Storage).';
comment on column checklist_perbaikan.video_drive_file_id is 'Lihat foto_drive_file_id.';
comment on column checklist_perbaikan.foto_bukti_drive_file_id is 'Lihat foto_drive_file_id, versi bukti pengerjaan Mandor.';
comment on column checklist_perbaikan.video_bukti_drive_file_id is 'Lihat foto_drive_file_id, versi bukti pengerjaan Mandor.';
