-- Jalankan di Supabase Studio > SQL Editor
-- Fitur: retensi otomatis foto/video Defect List di Supabase Storage
-- (lihat app/api/drive-sync/confirm & app/api/drive-sync/cleanup).

alter table checklist_perbaikan add column if not exists drive_synced_at timestamptz;

comment on column checklist_perbaikan.drive_synced_at is
  'Waktu foto/video item ini terkonfirmasi sudah ke-backup ke Google Drive (diisi n8n lewat /api/drive-sync/confirm). NULL = belum/gagal sync -- TIDAK PERNAH dihapus otomatis oleh cleanup job sampai ini terisi.';
