-- Jalankan di Supabase Studio > SQL Editor
-- Perluasan retensi otomatis (lihat add_checklist_drive_sync.sql) supaya
-- juga mencakup foto/video BUKTI PENGERJAAN dari Mandor, bukan cuma foto
-- temuan awal dari Supervisor. Kolom terpisah dari drive_synced_at karena
-- temuan awal & bukti bisa disubmit di waktu yang beda jauh (bukti kadang
-- baru dikirim beberapa hari setelah temuan dibuat).

alter table checklist_perbaikan add column if not exists bukti_synced_at timestamptz;

comment on column checklist_perbaikan.bukti_synced_at is
  'Waktu foto/video BUKTI PENGERJAAN item ini terkonfirmasi sudah ke-backup ke Google Drive (diisi n8n lewat /api/drive-sync/confirm). NULL = belum/gagal sync -- TIDAK PERNAH dihapus otomatis oleh cleanup job sampai ini terisi.';
