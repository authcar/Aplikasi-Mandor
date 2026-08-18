-- Jalankan di Supabase Studio > SQL Editor
--
-- Masalah: Taraco mengizinkan 1 proyek dipegang >1 mandor (projects.mandors,
-- jsonb array), tapi sync cuma menyimpan mandor PERTAMA ke kolom tunggal
-- proyek.mandor_id (lihat lib/supabase/syncProyek.js). Daftar lengkapnya ada
-- di proyek_mandor (add_proyek_mandor.sql), namun my_proyek_ids() — helper
-- yang jadi dasar hampir semua policy — tidak pernah melihat tabel itu.
-- Akibatnya mandor ke-2 dst tidak bisa membaca baris proyeknya sendiri
-- (contoh nyata: "PT. AMS" dipegang Pak Ndan + Test Mandor, cuma Pak Ndan
-- yang bisa melihatnya), dan ikut terblokir di semua tabel turunannya.
--
-- Fix: tambahkan proyek_mandor sebagai sumber ke-4 di my_proyek_ids(). Karena
-- fungsi ini SECURITY DEFINER (bypass RLS), membaca proyek_mandor di dalamnya
-- tidak memicu rekursi dengan policy proyek_mandor_read. Perubahan ini
-- otomatis mengalir ke SEMUA policy yang sudah memakai helper: proyek,
-- masalah, lembur, keuangan, absensi, progres_foto, tukang,
-- checklist_perbaikan, laporan_harian.
--
-- Definisi di bawah dimulai dari versi TERAKHIR yang berlaku, yaitu milik
-- add_finance_rls.sql (yang sudah mencakup FINANCE) — bukan versi di
-- schema.sql yang konsolidasinya berhenti di 2026-07-13.

create or replace function my_proyek_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from proyek
  where mandor_id = auth.uid() or supervisor_id = auth.uid()
  union
  select proyek_id from proyek_mandor where mandor_id = auth.uid()
  union
  select proyek_id from profiles where id = auth.uid() and proyek_id is not null
  union
  select id from proyek
  where (select role from profiles where id = auth.uid()) in ('MASTER', 'FINANCE')
$$;

-- proyek_read sendiri tidak perlu diubah: klausa ketiganya sudah
-- "id in (select my_proyek_ids())", jadi ikut terbawa perubahan di atas.
-- Ditulis ulang di sini hanya supaya file ini aman dijalankan di database
-- yang policy-nya sempat kena drift.
drop policy if exists proyek_read on proyek;
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid()
         or supervisor_id = auth.uid()
         or id in (select my_proyek_ids()));
