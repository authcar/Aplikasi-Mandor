-- Video bukti pengerjaan (opsional, sejajar foto_bukti_url) — Mandor bisa
-- lampirkan video selain/tanpa foto saat "Tandai Selesai" lewat
-- app/mandor/perbaikan/PerbaikanMandorList.jsx. Disimpan di bucket storage
-- 'perbaikan' yang sama, RLS-nya sudah mencakup bucket ini.
alter table checklist_perbaikan
  add column if not exists video_bukti_url text;
