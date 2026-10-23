-- Portal Klien: foto bukti pembayaran termin.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_termin.bukti
--   Path foto bukti pembayaran di bucket privat 'portal-item'
--   (add_portal_item_foto.sql). Wajib terisi sebelum termin bisa ditandai lunas
--   (dicek di server, lihat ubahTermin di aksi.js). Hanya admin yang melihatnya.

alter table portal_termin add column if not exists bukti text;

notify pgrst, 'reload schema';
