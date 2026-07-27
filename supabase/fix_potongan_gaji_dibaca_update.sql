-- Jalankan di Supabase Studio > SQL Editor.
--
-- Bug: badge "Rekap Gaji" di dashboard Supervisor tidak pernah hilang walau
-- halaman /supervisor/gaji sudah dibuka. Penyebabnya: fix_potongan_gaji_rls.sql
-- sengaja hanya membuat kebijakan RLS untuk SELECT pada potongan_gaji, tanpa
-- UPDATE. Akibatnya query di app/supervisor/gaji/page.jsx yang menandai
-- `dibaca_supervisor = true` diblokir diam-diam oleh RLS (0 baris ter-update,
-- tanpa error) karena client di sana pakai anon-key (tunduk RLS), bukan
-- service-role.
--
-- Fix ini ADDITIVE (nama kebijakan baru): mengizinkan supervisor meng-update
-- baris potongan_gaji miliknya sendiri saja (dicocokkan lewat chat_id, sama
-- seperti kebijakan potongan_gaji_own_read).

drop policy if exists potongan_gaji_own_update on potongan_gaji;
create policy potongan_gaji_own_update on potongan_gaji for update
  using (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  )
  with check (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  );
