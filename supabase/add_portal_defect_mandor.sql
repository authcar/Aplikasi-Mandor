-- Portal Klien: defect dari klien masuk ke Defect List Aplikasi Mandor.
-- Kalau proyek portal namanya sama dengan proyek Mandor yang AKTIF (lihat
-- lib/portal/mandor.js), laporan klien dibuat sebagai item checklist_perbaikan
-- di proyek Mandor itu (alur biasa: mandor kerjakan, kirim bukti, supervisor
-- setujui). Baris portal_defect tetap ada sebagai catatan klien (pelapor,
-- item, keterangan) dan menunjuk ke item checklist-nya lewat checklist_id;
-- status & foto bukti di halaman klien dibaca dari checklist itu.
-- Butuh supabase/add_portal_defect.sql sudah dijalankan.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_defect
  add column if not exists checklist_id uuid references checklist_perbaikan(id) on delete set null;
create index if not exists idx_portal_defect_checklist on portal_defect(checklist_id);
