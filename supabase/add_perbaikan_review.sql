-- Jalankan di Supabase Studio > SQL Editor.
--
-- Alur baru Checklist Perbaikan: Mandor menandai item selesai DENGAN foto
-- bukti pengerjaan -> status jadi PENDING_REVIEW -> Supervisor menyetujui
-- (jadi DONE) atau menolak (balik ke OPEN, Mandor mengulang). Master bisa
-- melihat riwayat semuanya (read-only) di /master/perbaikan.
--
-- Tidak perlu policy RLS/storage baru: checklist_rw (schema.sql) sudah
-- "for all" untuk siapa saja di proyek itu (termasuk Mandor & Master lewat
-- my_proyek_ids()), dan bucket storage 'perbaikan' sudah mengizinkan
-- read/write dengan path '<proyek_id>/<file>' untuk siapa saja di proyek itu.

alter type status_mslh add value if not exists 'PENDING_REVIEW';

-- Foto bukti pengerjaan dari Mandor — terpisah dari foto_url (foto awal
-- temuan yang diunggah Supervisor saat membuat item).
alter table checklist_perbaikan add column if not exists foto_bukti_url text;

-- Badge "baru" utk Supervisor: ada bukti pengerjaan menunggu direview.
-- Ditandai true lagi saat Supervisor membuka /supervisor/perbaikan (sama
-- pola dengan dibaca_mandor).
alter table checklist_perbaikan add column if not exists dibaca_supervisor boolean not null default true;
