-- Jalankan di Supabase Studio > SQL Editor.
--
-- Alasan penolakan Master saat menolak pengajuan Kasbon/Reimburse (tombol
-- "Tolak" di app/master/persetujuan), supaya Supervisor/Mandor pengaju tahu
-- apa yang perlu diperbaiki — sama pola dengan catatan_tolak di
-- checklist_perbaikan (add_perbaikan_catatan_tolak.sql).

alter table keuangan add column if not exists catatan_tolak text;
