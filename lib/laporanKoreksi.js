// Aturan siapa boleh mengoreksi (edit/hapus) sebuah laporan harian.
// Dipakai di API (penentu sebenarnya, di samping RLS) dan di UI (tampil/tidaknya tombol).
//   MASTER     -> semua laporan, kapan saja
//   SUPERVISOR, HEAD_OF_PRODUCTION -> hanya laporannya sendiri, kapan saja

export function bolehKoreksiLaporan({ peran, userId, laporan }) {
  if (!laporan) return false;
  if (peran === "MASTER") return true;
  if (peran === "SUPERVISOR" || peran === "HEAD_OF_PRODUCTION")
    return !!userId && laporan.created_by === userId;
  return false;
}
