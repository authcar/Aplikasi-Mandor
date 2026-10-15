-- Portal Klien (Project Tracker): rincian jasa tukang per item.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- portal_item.harga_satuan
--   Harga satuan jasa tukang (kolom "Harga Satuan" di Hitungan Jasa Pekerjaan).
-- portal_item.tim
--   Tim tukang yang mengerjakan item (mis. "Mas Alan", "Pak Ndan").
-- Total jasa tukang item tetap di portal_item.harga (kolom "Total" di Excel,
-- diambil apa adanya karena rumusnya beda-beda: P x T, P, qty, ...).

alter table portal_item add column if not exists harga_satuan numeric(14,0) check (harga_satuan >= 0);
alter table portal_item add column if not exists tim text;

-- Supaya API Supabase langsung mengenali kolom baru.
notify pgrst, 'reload schema';
