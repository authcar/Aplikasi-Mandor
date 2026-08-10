-- Jalankan di Supabase Studio > SQL Editor
--
-- Latar belakang: Taraco sekarang mengizinkan 1 proyek dipegang lebih dari
-- 1 mandor (projects.mandors, jsonb array nama — lihat lib/supabase/syncProyek.js).
-- proyek.mandor_id tetap kolom tunggal (mandor pertama di array) supaya kode
-- lama yang sudah bergantung padanya (dropdown proyek, "Mandor Penanggung
-- Jawab", fallback notifikasi) tidak perlu diubah. Tabel ini menyimpan daftar
-- LENGKAP mandor yang dipegang tiap proyek, disinkron otomatis dari Taraco —
-- dipakai Supervisor buat membatasi pilihan "assign ke mandor" per item
-- Defect List hanya ke mandor yang benar-benar dipegang proyek tsb (lihat
-- app/supervisor/perbaikan/PerbaikanForm.jsx).

create table if not exists proyek_mandor (
  proyek_id  uuid not null references proyek(id) on delete cascade,
  mandor_id  uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (proyek_id, mandor_id)
);
create index if not exists idx_proyek_mandor_mandor on proyek_mandor(mandor_id);

alter table proyek_mandor enable row level security;

-- Ditulis hanya oleh sync (service role, bypass RLS) — tidak ada policy
-- insert/update/delete untuk user biasa. Dibaca oleh: mandor bersangkutan
-- (lihat proyeknya sendiri), Supervisor pemilik proyek (buat isi picker
-- assign), dan MASTER (pantau semua).
drop policy if exists proyek_mandor_read on proyek_mandor;
create policy proyek_mandor_read on proyek_mandor for select
  using (
    mandor_id = auth.uid()
    or my_role() = 'MASTER'
    or proyek_id in (select id from proyek where supervisor_id = auth.uid())
  );
