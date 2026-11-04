// Aturan jam absen pegawai (clock in / clock out).
//
// Murni — tanpa DB dan tanpa "sekarang" implisit — supaya server dan layar
// memakai angka yang sama dan aturannya mudah diuji. Jam kerja 09:00–17:00 WIB.
// Indonesia tidak punya DST, jadi WIB selalu UTC+7.

export const JAM_MASUK = 9;           // 09:00 WIB
export const JAM_PULANG = 17;         // 17:00 WIB
export const BUKA_MASUK_JAM = 8;      // absen masuk baru dibuka mulai 08:00
export const TOLERANSI_TELAT_MENIT = 0; // 0 = lewat 09:00:00 langsung dihitung telat

const FMT_WIB = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Tanggal kalender WIB, format YYYY-MM-DD. Server memakai ini untuk kolom
// `tanggal` — jangan toISOString().slice(0, 10), itu tanggal UTC dan meleset
// sehari antara 00:00–07:00 WIB.
export const tanggalWIB = (d = new Date()) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

// Menit sejak tengah malam WIB.
export function menitWIB(d = new Date()) {
  const [jam, menit] = FMT_WIB.format(d).split(":").map(Number);
  return (jam % 24) * 60 + menit;
}

export const sudahBukaMasuk = (d = new Date()) => menitWIB(d) >= BUKA_MASUK_JAM * 60;

// Telat kalau menit-nya melewati 09:00 + toleransi. Detik sengaja diabaikan:
// 09:00:40 masih "09:00" di layar, dan layar itulah yang dilihat orangnya.
export const apakahTerlambat = (d = new Date()) =>
  menitWIB(d) > JAM_MASUK * 60 + TOLERANSI_TELAT_MENIT;

// Pulang sebelum 17:00 tetap sah dicatat (orang bisa sakit / ada urusan),
// cuma diberi penanda.
export const apakahPulangCepat = (d = new Date()) => menitWIB(d) < JAM_PULANG * 60;

export function formatJam(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

// "07:45" dari dua timestamp, atau "--:--" kalau salah satunya belum ada.
export function durasiKerja(masukAt, keluarAt) {
  if (!masukAt || !keluarAt) return "--:--";
  const ms = new Date(keluarAt) - new Date(masukAt);
  if (!(ms > 0)) return "--:--";
  const menit = Math.round(ms / 60000);
  return `${String(Math.floor(menit / 60)).padStart(2, "0")}:${String(menit % 60).padStart(2, "0")}`;
}

// Tautan peta untuk koordinat tersimpan — dipakai halaman rekap.
export const tautanPeta = (lat, lng) =>
  `https://www.google.com/maps?q=${lat},${lng}`;
