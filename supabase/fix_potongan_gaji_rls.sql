-- Jalankan di Supabase Studio > SQL Editor.
--
-- potongan_gaji (potongan/deduction gaji) TIDAK ada di schema.sql atau
-- migrasi manapun — dibuat manual di Studio, jadi tidak bisa dipastikan dari
-- kode bahwa satu akun tidak bisa membaca data potongan gaji akun lain.
-- app/api/potongan/route.js dan app/supervisor/gaji/page.jsx hanya menyaring
-- lewat `chat_id` di kode aplikasi, tanpa filter kepemilikan proyek — jadi
-- keamanannya 100% bergantung ke RLS.
--
-- Fix ini ADDITIVE (nama kebijakan baru) dan HANYA mengizinkan SELECT baris
-- milik akun itu sendiri (dicocokkan lewat chat_id, sama seperti kebijakan
-- checkin_harian_own_rw yang sudah dibuat di add_master_rls_gaps_untracked.sql).
-- Sengaja tidak diberi izin insert/update/delete di sini — potongan gaji
-- diasumsikan hanya diisi lewat proses lain (mis. bot Telegram lewat
-- service-role key, yang otomatis bypass RLS), bukan lewat aplikasi ini.
-- Kalau ternyata aplikasi PERLU menulis ke tabel ini, beri tahu supaya
-- kebijakan write ditambahkan secara sadar, bukan longgar begitu saja.

alter table potongan_gaji enable row level security;

drop policy if exists potongan_gaji_own_read on potongan_gaji;
create policy potongan_gaji_own_read on potongan_gaji for select
  using (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  );
