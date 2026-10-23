-- Portal Klien: defect dari klien dipilih per AREA (bukan per item).
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_defect.area
--   Nama area BOQ yang dilaporkan klien (mis. "Kitchen Room"). Defect lama
--   tetap memakai item_id.
-- Butuh supabase/add_portal_defect.sql sudah dijalankan.

alter table portal_defect add column if not exists area text;

notify pgrst, 'reload schema';
