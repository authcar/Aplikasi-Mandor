// Aturan siapa boleh mengoreksi (edit/hapus) sebuah laporan harian.
// Dipakai di API (penentu sebenarnya, di samping RLS) dan di UI (tampil/tidaknya tombol).
//   MASTER     -> semua laporan, kapan saja
//   SUPERVISOR -> hanya laporannya sendiri, dan hanya di hari (WIB) saat laporan dibuat
const hariWib = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export function bolehKoreksiLaporan({ peran, userId, laporan }) {
  if (!laporan) return false;
  if (peran === "MASTER") return true;
  if (peran === "SUPERVISOR")
    return !!userId && laporan.created_by === userId && hariWib(laporan.created_at) === hariWib(new Date());
  return false;
}
