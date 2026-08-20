-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_kunjungan_supervisor.sql
--
-- Pemantauan lokasi DI TENGAH kunjungan Supervisor.
--
-- Sampai sebelum ini lokasi cuma diperiksa dua kali: saat tap absen masuk dan
-- saat tap absen keluar. Di antara keduanya sistem buta — supervisor yang
-- absen masuk di lokasi, pergi dua jam, lalu kembali untuk absen keluar
-- tercatat SELESAI sepenuhnya normal. Radius seberapa pun besarnya tidak
-- menutup lubang ini, karena masalahnya bukan luas area melainkan JUMLAH
-- pemeriksaan.
--
-- Dua mekanisme dipasang berdampingan, dan sengaja keduanya, bukan salah satu:
--
--   • HEARTBEAT  — selama aplikasi terbuka, kartu kunjungan mengirim posisi
--                  tiap beberapa menit. Murah dan otomatis, TAPI browser HP
--                  tidak bisa membaca GPS di background: begitu layar dikunci
--                  atau aplikasi di-swipe ke belakang, heartbeat mati total.
--                  Jadi ketiadaan heartbeat TIDAK pernah dihukum — terlalu
--                  banyak sebab yang jujur (sinyal, baterai, layar mati).
--
--   • SPOT-CHECK — justru untuk menambal lubang itu. Server memilih waktu acak
--                  selama kunjungan berjalan, mengirim web push, dan
--                  supervisor harus membuka aplikasi lalu mengirim posisinya
--                  dalam batas waktu. Ini yang boleh dihukum kalau tidak
--                  dijawab, karena di sini ada permintaan eksplisit yang
--                  diabaikan — bukan sekadar timer yang kebetulan berhenti.

-- =====================================================================
-- 1) Radius default naik 300 -> 500 meter
-- =====================================================================
-- Radius 300 m mencakup ~28 hektar, 500 m jadi ~78 hektar. Pelonggaran ini
-- aman DIBARENGI pemantauan di tengah kunjungan, dan tidak akan aman tanpanya:
-- yang menjaga kehadiran sekarang adalah seringnya pemeriksaan, bukan sempitnya
-- lingkaran.
alter table proyek alter column radius_meter set default 500;

-- Baris lama ikut dinaikkan, tapi HANYA yang masih persis di angka default
-- lama. Proyek yang radiusnya pernah disetel manual (berapa pun angkanya,
-- selama bukan 300) itu keputusan sadar seseorang dan tidak boleh ditimpa
-- diam-diam oleh migrasi.
update proyek set radius_meter = 500 where radius_meter = 300;

-- =====================================================================
-- 2) Riwayat pantauan
-- =====================================================================
-- Satu baris per pemeriksaan. Baris SPOTCHECK dibuat lebih dulu saat push
-- dikirim (waktu/lat/lng masih null) lalu diisi saat dijawab — itu sebabnya
-- kolom posisinya nullable, sedangkan baris HEARTBEAT selalu lahir lengkap.
create table if not exists kunjungan_pantau (
  id           uuid primary key default gen_random_uuid(),
  kunjungan_id uuid not null references kunjungan_supervisor(id) on delete cascade,

  jenis        text not null check (jenis in ('HEARTBEAT', 'SPOTCHECK')),

  diminta_at   timestamptz,   -- SPOTCHECK: kapan web push dikirim
  batas_at     timestamptz,   -- SPOTCHECK: batas akhir menjawab

  waktu        timestamptz,   -- kapan posisi diterima (null = belum dijawab)
  lat          double precision,
  lng          double precision,
  akurasi      numeric(8,1),  -- meter, dari GPS perangkat

  -- Jarak EFEKTIF ke titik proyek: sudah dikurangi margin error GPS, sama
  -- seperti perhitungan saat absen masuk/keluar. Disimpan hasil jadinya
  -- supaya rekap tidak perlu menghitung ulang dengan rumus yang bisa
  -- keburu berbeda.
  jarak        numeric(10,1),

  hasil        text check (hasil in ('DI_DALAM', 'DI_LUAR', 'TIDAK_DIJAWAB')),
  created_at   timestamptz default now()
);

create index if not exists idx_pantau_kunjungan on kunjungan_pantau(kunjungan_id, created_at desc);

-- Satu kunjungan tidak boleh punya dua spot-check menggantung sekaligus —
-- kalau tidak, penjadwal yang jalan dua kali (atau retry n8n) bisa membanjiri
-- satu orang dengan push dan menumpuk pelanggaran dari satu kejadian.
create unique index if not exists idx_pantau_satu_spotcheck_terbuka
  on kunjungan_pantau(kunjungan_id)
  where jenis = 'SPOTCHECK' and hasil is null;

-- =====================================================================
-- 3) RLS — select-only, sama alasannya dengan kunjungan_supervisor
-- =====================================================================
-- Tidak ada policy insert/update untuk user biasa. Satu-satunya jalan menulis
-- adalah /api/kunjungan/pantau dan /api/kunjungan/spot-check, yang menghitung
-- jaraknya DI SERVER lalu menulis pakai service role. Kalau client boleh
-- menulis sendiri, seluruh pemantauan ini bisa dipalsukan dari devtools dan
-- tidak ada gunanya dibuat.
alter table kunjungan_pantau enable row level security;

-- Hak baca diturunkan dari kunjungan induknya, bukan ditulis ulang — supaya
-- kalau kunjungan_read berubah, pantauan tidak diam-diam jadi lebih longgar.
drop policy if exists pantau_read on kunjungan_pantau;
create policy pantau_read on kunjungan_pantau for select
  using (
    exists (
      select 1 from kunjungan_supervisor k
      where k.id = kunjungan_pantau.kunjungan_id
        and (
          k.profile_id = auth.uid()
          or my_role() in ('MASTER', 'FINANCE')
          or k.proyek_id in (select id from proyek where supervisor_id = auth.uid())
        )
    )
  );
