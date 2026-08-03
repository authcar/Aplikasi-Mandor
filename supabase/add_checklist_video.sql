-- Video dokumentasi temuan (opsional, sejajar foto_url) — Supervisor bisa
-- lampirkan video selain/tanpa foto saat lapor temuan lewat PerbaikanForm
-- (app/supervisor/perbaikan/PerbaikanForm.jsx). Disimpan di bucket storage
-- 'perbaikan' yang sama dengan foto_url, RLS-nya sudah mencakup bucket ini.
alter table checklist_perbaikan
  add column if not exists video_url text;
