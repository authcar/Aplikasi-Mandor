-- Video dokumentasi kekurangan material (opsional, sejajar foto_url) —
-- Mandor/Tukang Harian/Supervisor bisa lampirkan video selain/tanpa foto
-- saat lapor lewat MasalahForm.jsx. Disimpan di bucket storage 'masalah'
-- yang sama dengan foto_url, RLS-nya sudah mencakup bucket ini.
alter table masalah
  add column if not exists video_url text;
