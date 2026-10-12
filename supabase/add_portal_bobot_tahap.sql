-- Portal Klien: bobot tiap tahap pekerjaan (persen) per jenis item, diatur
-- MASTER di /portal/bobot. Berlaku untuk SEMUA proyek portal.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.
--
-- Tabel ini hanya berisi jenis yang sudah diubah admin; jenis yang tidak ada
-- barisnya memakai bobot bawaan di lib/portal/progresBoq.js. Satu jenis
-- selalu disimpan lengkap (semua tahapnya) dan berjumlah 100.
--
-- Sama seperti tabel portal_* lain: hanya diakses dari server (service role),
-- RLS menyala tanpa policy.

create table if not exists portal_bobot_tahap (
  jenis      text not null check (jenis in ('HPL', 'DUCO', 'VENDOR', 'SIPIL')),
  tahap      text not null,
  bobot      numeric(5,2) not null check (bobot >= 0 and bobot <= 100),
  diubah_oleh uuid references profiles(id) on delete set null,
  diubah_at  timestamptz not null default now(),
  primary key (jenis, tahap)
);

alter table portal_bobot_tahap enable row level security;
