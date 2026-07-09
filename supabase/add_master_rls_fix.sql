-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_master_role.sql.
--
-- Kenapa: audit menemukan peran MASTER tidak pernah disebut di satu pun
-- kebijakan RLS di seluruh file migrasi. Akibatnya:
--   1. proyek yang dibuat SUPERVISOR tidak terbaca oleh MASTER (RLS proyek_read
--      hanya mengizinkan mandor_id/supervisor_id/proyek_id milik pemanggil).
--   2. /api/approval dan /api/masalah sudah diubah mengizinkan role MASTER,
--      tapi update ke tabel lembur/keuangan masih akan ditolak RLS
--      (lembur_review/keuangan_review mensyaratkan my_role() = 'SUPERVISOR').
--   3. MASTER tidak bisa melihat nama Supervisor/Mandor (perlu utk form
--      "Proyek Baru" milik Master menugaskan Supervisor yang sebenarnya,
--      bukan uid Master sendiri seperti sebelumnya).
--
-- Semua perubahan di bawah ADDITIVE terhadap peran lain (MANDOR/SUPERVISOR/
-- TUKANG_HARIAN tetap seperti sebelumnya) — hanya menambah akses utk MASTER.

-- 1) my_proyek_ids(): MASTER melihat SEMUA proyek. Ini otomatis mengalir ke
--    setiap kebijakan yang sudah memakai helper ini: masalah, lembur, keuangan,
--    absensi, progres_foto, tukang, checklist_perbaikan.
create or replace function my_proyek_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from proyek
  where mandor_id = auth.uid() or supervisor_id = auth.uid()
  union
  select proyek_id from profiles where id = auth.uid() and proyek_id is not null
  union
  select id from proyek
  where (select role from profiles where id = auth.uid()) = 'MASTER'
$$;

-- 2) proyek_read: konsolidasi kembali memakai my_proyek_ids() (sempat diganti
--    jadi subquery manual di add_tukang_harian_proyek.sql) supaya MASTER ikut
--    tercakup lewat perubahan #1 di atas.
drop policy if exists proyek_read on proyek;
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid()
         or supervisor_id = auth.uid()
         or id in (select my_proyek_ids()));

-- 3) proyek_write: MASTER boleh membuat/mengubah proyek apa pun (termasuk
--    menugaskan supervisor_id ke Supervisor sungguhan, dan mengubah nilai_proyek).
drop policy if exists proyek_write on proyek;
create policy proyek_write on proyek for all
  using (supervisor_id = auth.uid() or my_role() = 'MASTER')
  with check (supervisor_id = auth.uid() or my_role() = 'MASTER');

-- 4) lembur_review / keuangan_review: MASTER boleh menyetujui/menolak, sama
--    seperti Supervisor.
drop policy if exists lembur_review on lembur;
create policy lembur_review on lembur for update
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() = 'MASTER'
  );

drop policy if exists keuangan_review on keuangan;
create policy keuangan_review on keuangan for update
  using (
    (my_role() = 'SUPERVISOR' and proyek_id in (select id from proyek where supervisor_id = auth.uid()))
    or my_role() = 'MASTER'
  );

-- 5) profiles: MASTER boleh melihat profil SUPERVISOR & MANDOR (untuk memilih
--    Supervisor/Mandor saat membuat/mengelola proyek). Kebijakan baru,
--    tidak mengubah profiles_self/profiles_list_mandor yang sudah ada.
drop policy if exists profiles_list_for_master on profiles;
create policy profiles_list_for_master on profiles for select
  using (my_role() = 'MASTER' and role in ('SUPERVISOR', 'MANDOR'));

-- =====================================================================
-- Catatan: absensi_ringkas, absensi_tim, checkin_harian, nilai_proyek
-- (kolom), potongan_gaji TIDAK ada di schema.sql/migrasi manapun (dibuat
-- manual di Studio). Jalankan check_master_rls_gaps.sql (file terpisah)
-- untuk menambah akses MASTER pada absensi_ringkas & absensi_tim yang
-- kolomnya sudah diketahui pasti dari kode aplikasi.
-- =====================================================================
