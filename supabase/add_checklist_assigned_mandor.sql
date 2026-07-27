-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_perbaikan_review.sql
-- dan add_perbaikan_catatan_tolak.sql.
--
-- Latar belakang: proyek.mandor_id diisi otomatis lewat sync nama dari
-- Taraco (lib/supabase/syncProyek.js) — kalau nama mandor di Taraco tidak
-- cocok persis dengan nama akun MANDOR di sini, mandor_id jadi NULL dan
-- checklist perbaikan proyek itu tidak pernah muncul ke Mandor manapun.
--
-- Fix: Supervisor bisa assign checklist perbaikan ke Mandor tertentu secara
-- manual lewat kolom assigned_mandor_id, lepas dari proyek.mandor_id. Kalau
-- kosong (default), perilaku lama tetap berlaku — visibilitas ikut
-- proyek.mandor_id seperti biasa.

alter table checklist_perbaikan add column if not exists assigned_mandor_id uuid references profiles(id);

-- checklist_perbaikan: Mandor yang di-assign langsung ke item ini boleh
-- baca/tulis, lepas dari apakah dia mandor resmi proyek itu (proyek_id in
-- my_proyek_ids()) atau bukan.
drop policy if exists checklist_rw on checklist_perbaikan;
create policy checklist_rw on checklist_perbaikan for all
  using (proyek_id in (select my_proyek_ids()) or assigned_mandor_id = auth.uid())
  with check (proyek_id in (select my_proyek_ids()) or assigned_mandor_id = auth.uid());

-- proyek: Mandor yang di-assign lewat checklist_perbaikan.assigned_mandor_id
-- perlu bisa baca info dasar proyeknya (buat nampilin nama proyek di card),
-- walau bukan mandor resmi proyek itu di kolom proyek.mandor_id.
drop policy if exists proyek_read on proyek;
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid()
         or supervisor_id = auth.uid()
         or id in (select my_proyek_ids())
         or id in (select proyek_id from checklist_perbaikan where assigned_mandor_id = auth.uid()));

-- storage 'perbaikan': sama — Mandor yang di-assign langsung boleh
-- upload/baca foto bukti di folder proyek itu (path '<proyek_id>/<file>')
-- walau bukan mandor resmi proyeknya.
drop policy if exists storage_read on storage.objects;
create policy storage_read on storage.objects for select
  using (
    (bucket_id in ('progres','nota','masalah','perbaikan','lembur')
     and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()))
    or
    (bucket_id = 'perbaikan'
     and (storage.foldername(name))[1]::uuid in
         (select proyek_id from checklist_perbaikan where assigned_mandor_id = auth.uid()))
  );
drop policy if exists storage_write on storage.objects;
create policy storage_write on storage.objects for insert
  with check (
    (bucket_id in ('progres','nota','masalah','perbaikan','lembur')
     and (storage.foldername(name))[1]::uuid in (select my_proyek_ids()))
    or
    (bucket_id = 'perbaikan'
     and (storage.foldername(name))[1]::uuid in
         (select proyek_id from checklist_perbaikan where assigned_mandor_id = auth.uid()))
  );
