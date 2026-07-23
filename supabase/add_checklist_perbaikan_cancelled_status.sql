-- Jalankan di Supabase Studio > SQL Editor
-- Tambah status CANCELLED pada checklist_perbaikan: SPV bisa membatalkan item,
-- item tetap tampil di halaman mandor/tukang harian dengan label "Dibatalkan".

alter type status_mslh add value if not exists 'CANCELLED';
