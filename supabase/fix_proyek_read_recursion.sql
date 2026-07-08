-- Jalankan di Supabase Studio > SQL Editor
-- Fix: proyek_read policy sebelumnya query langsung ke `profiles`, yang
-- policy-nya (profiles_self) balik query ke `proyek` -> infinite recursion
-- (error 42P17), bikin SEMUA login gagal (bukan cuma tukang harian).
--
-- Fix: pakai helper my_proyek_ids() yang sudah SECURITY DEFINER (bypass RLS
-- secara aman), bukan subquery mentah ke profiles.

drop policy if exists proyek_read on proyek;
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid()
         or supervisor_id = auth.uid()
         or id in (select my_proyek_ids()));
