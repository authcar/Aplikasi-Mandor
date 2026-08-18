// Aturan sah/tidaknya sebuah kunjungan Supervisor.
//
// Sengaja dipisah dari route-nya dan dibuat murni (tanpa DB, tanpa waktu
// "sekarang" implisit) supaya aturannya bisa dibaca di satu tempat dan diuji
// tanpa perlu sesi login. Dipakai oleh app/api/kunjungan (absen keluar) dan
// app/api/kunjungan/tutup-otomatis (potong otomatis jam 17:00).

// Kunjungan yang lebih pendek dari ini dianggap tidak sah — sekadar mampir,
// bukan mengawasi.
export const DURASI_MINIMUM_MENIT = 10;

// Jam potong otomatis untuk kunjungan yang tidak pernah diabsen keluar.
// Angka 17 menyamai JAM_PULANG di components/AbsensiSayaCard.jsx.
export const JAM_POTONG_WIB = 17;

// Kapan sebuah kunjungan seharusnya sudah ditutup paksa?
//
// Jam 17:00 WIB pada tanggal kunjungan itu dimulai. Kalau kunjungannya justru
// dimulai setelah jam 17:00, batasnya digeser ke 17:00 keesokan harinya —
// kalau tidak, kunjungan sore hari akan langsung dianggap kedaluwarsa pada
// detik yang sama ia dibuat.
//
// Indonesia tidak punya DST, jadi WIB selalu UTC+7 dan offset-nya aman
// ditulis tetap.
export function batasTutupOtomatis(mulaiAt) {
  const mulai = new Date(mulaiAt);
  const tanggalWIB = mulai.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  let batas = new Date(`${tanggalWIB}T${String(JAM_POTONG_WIB).padStart(2, "0")}:00:00+07:00`);
  if (mulai >= batas) batas = new Date(batas.getTime() + 24 * 60 * 60 * 1000);
  return batas;
}

// Sudah lewat batas potong?
export const sudahKedaluwarsa = (mulaiAt, sekarang = new Date()) =>
  sekarang >= batasTutupOtomatis(mulaiAt);

// Status akhir sebuah kunjungan saat diabsen keluar.
//
// Alasan dikumpulkan sebagai daftar, bukan satu-yang-pertama-menang: sebuah
// kunjungan bisa gagal karena dua hal sekaligus (keluar dari luar radius DAN
// cuma 4 menit), dan menampilkan salah satunya saja membuat rekapnya
// menyesatkan.
export function nilaiKunjungan({ menit, jarakKeluar = null, radiusMeter = null }) {
  const alasan = [];

  if (jarakKeluar != null && radiusMeter != null && jarakKeluar > radiusMeter)
    alasan.push(`Absen keluar dari ${Math.round(jarakKeluar)}m di luar radius ${radiusMeter}m.`);

  // Dibulatkan KE BAWAH, bukan ke terdekat: durasi 9,6 menit yang dibulatkan
  // jadi 10 menghasilkan kalimat "Durasi 10 menit, di bawah minimum 10 menit"
  // — terbaca seperti bug padahal aturannya benar.
  if (Number.isFinite(menit) && menit < DURASI_MINIMUM_MENIT)
    alasan.push(
      `Durasi ${Math.max(0, Math.floor(menit))} menit, di bawah minimum ${DURASI_MINIMUM_MENIT} menit.`
    );

  return {
    status: alasan.length ? "TIDAK_SAH" : "SELESAI",
    catatan: alasan.length ? alasan.join(" ") : null,
  };
}
