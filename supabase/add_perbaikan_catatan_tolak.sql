-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_perbaikan_review.sql.
--
-- Alasan penolakan Supervisor saat menolak bukti pengerjaan Mandor (tombol
-- "Tolak" di app/supervisor/perbaikan), supaya Mandor tahu apa yang perlu
-- diperbaiki, bukan cuma disuruh ulang tanpa konteks.

alter table checklist_perbaikan add column if not exists catatan_tolak text;
