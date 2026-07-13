-- Jalankan di Supabase Studio > SQL Editor.
--
-- Bug: kolom dibaca_mandor dipakai sebagai penanda "sudah dibaca" bersama utk
-- MANDOR dan TUKANG_HARIAN di proyek yang sama. Siapa pun yang membuka
-- halaman Checklist Perbaikan duluan langsung menghilangkan badge "baru"
-- utk peran yang lain, walau yang lain belum pernah melihatnya.
--
-- Fix: tambah kolom terpisah khusus utk Tukang Harian. dibaca_mandor tetap
-- dipakai apa adanya utk Mandor (tidak diganti nama, supaya tidak perlu
-- migrasi data existing).

alter table checklist_perbaikan
  add column if not exists dibaca_tukang_harian boolean not null default false;
