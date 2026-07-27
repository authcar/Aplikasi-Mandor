-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_finance_role.sql
-- selesai jalan sendirian.
--
-- Beri FINANCE wewenang yang SAMA seperti MASTER di semua kebijakan RLS
-- yang secara eksplisit mengecek my_role() = 'MASTER'. Kebijakan lain yang
-- sudah bergantung pada my_proyek_ids() (checklist_perbaikan, absensi,
-- masalah, progres_foto, tukang, keuangan/lembur read+insert, proyek_read,
-- storage progres/nota/masalah/perbaikan/lembur) otomatis ikut ter-cover
-- begitu my_proyek_ids() diperbarui di bawah — tidak perlu disentuh satu-satu.
--
-- Semua blok di bawah ADDITIVE terhadap peran lain (MANDOR/SUPERVISOR/
-- TUKANG_HARIAN/MASTER tetap seperti sebelumnya) — hanya menambah akses
-- setara utk FINANCE.

-- 1) my_proyek_ids(): FINANCE melihat SEMUA proyek, sama seperti MASTER.
create or replace function my_proyek_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from proyek
  where mandor_id = auth.uid() or supervisor_id = auth.uid()
  union
  select proyek_id from profiles where id = auth.uid() and proyek_id is not null
  union
  select id from proyek
  where (select role from profiles where id = auth.uid()) in ('MASTER', 'FINANCE')
$$;

-- 2) profiles_list_for_master: FINANCE juga boleh melihat nama Supervisor/
--    Mandor (dipakai form Kelola Akun & assign proyek).
drop policy if exists profiles_list_for_master on profiles;
create policy profiles_list_for_master on profiles for select
  using (my_role() in ('MASTER', 'FINANCE') and role in ('SUPERVISOR', 'MANDOR'));

-- 3) proyek_write: FINANCE boleh membuat/mengubah proyek apa pun, sama
--    seperti MASTER (termasuk secara teknis field apa pun di baris proyek —
--    pembatasan field mana yang BENAR-BENAR bisa diubah lewat aplikasi
--    tetap dijaga di app/api/proyek/route.js, bukan di RLS ini).
drop policy if exists proyek_write on proyek;
create policy proyek_write on proyek for all
  using (supervisor_id = auth.uid() or my_role() in ('MASTER', 'FINANCE'))
  with check (supervisor_id = auth.uid() or my_role() in ('MASTER', 'FINANCE'));

-- 4) lembur_review / keuangan_review: FINANCE boleh menyetujui/menolak,
--    sama seperti MASTER.
drop policy if exists lembur_review on lembur;
create policy lembur_review on lembur for update
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() in ('MASTER', 'FINANCE')
  );

drop policy if exists keuangan_review on keuangan;
create policy keuangan_review on keuangan for update
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() in ('MASTER', 'FINANCE')
  );

-- 5) absensi_tim: FINANCE boleh baca/tulis sama seperti MASTER (data
--    company-wide, tidak per-proyek — lihat catatan di schema.sql).
drop policy if exists absensi_tim_rw on absensi_tim;
create policy absensi_tim_rw on absensi_tim for all
  using (
    exists (select 1 from proyek p where p.id in (select my_proyek_ids()))
    or my_role() in ('MASTER', 'FINANCE')
  )
  with check (created_by = auth.uid() or my_role() in ('MASTER', 'FINANCE'));

-- 6) storage bucket 'absensi': sama pola dengan absensi_tim_rw di atas.
drop policy if exists storage_absensi_rw on storage.objects;
create policy storage_absensi_rw on storage.objects for all
  using (
    bucket_id = 'absensi'
    and (exists (select 1 from proyek p where p.id in (select my_proyek_ids())) or my_role() in ('MASTER', 'FINANCE'))
  )
  with check (
    bucket_id = 'absensi'
    and (exists (select 1 from proyek p where p.id in (select my_proyek_ids())) or my_role() in ('MASTER', 'FINANCE'))
  );
