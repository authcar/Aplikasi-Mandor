-- Jalankan di Supabase Studio > SQL Editor
-- Tukang Harian: kaitkan akun ke satu proyek tetap.
-- Diisi manual (oleh mandor/supervisor) saat akun tukang harian dibuat,
-- lewat: update profiles set proyek_id = '<uuid proyek>' where id = '<uuid user>';

alter table profiles add column if not exists proyek_id uuid references proyek(id);

-- Perluas my_proyek_ids() supaya proyek milik tukang harian ikut terhitung
-- (dipakai oleh RLS tukang/absensi/lembur/keuangan/masalah/checklist_perbaikan).
create or replace function my_proyek_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from proyek
  where mandor_id = auth.uid() or supervisor_id = auth.uid()
  union
  select proyek_id from profiles where id = auth.uid() and proyek_id is not null
$$;

-- PROYEK: tukang harian boleh baca proyek yang ia ditugaskan.
drop policy if exists proyek_read on proyek;
create policy proyek_read on proyek for select
  using (mandor_id = auth.uid()
         or supervisor_id = auth.uid()
         or id in (select proyek_id from profiles where id = auth.uid() and proyek_id is not null));

-- CATATAN: tabel `absensi_ringkas` dan `checkin_harian` dipakai halaman
-- absensi/gaji tapi tidak ada di schema.sql (dibuat manual di Studio, di luar
-- migrasi ini). Pastikan RLS keduanya juga mengizinkan TUKANG_HARIAN
-- (idealnya lewat pola yang sama: proyek_id in (select my_proyek_ids()),
-- atau untuk checkin_harian yang keyed oleh chat_id: created_by/chat_id
-- milik user sendiri), kalau belum, insert/select dari halaman tukang harian
-- akan gagal walau kolom proyek_id di atas sudah ada.
