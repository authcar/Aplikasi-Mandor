// Aturan sah/tidaknya sebuah kunjungan Supervisor.
//
// Sengaja dipisah dari route-nya dan dibuat murni (tanpa DB, tanpa waktu
// "sekarang" implisit) supaya aturannya bisa dibaca di satu tempat dan diuji
// tanpa perlu sesi login. Dipakai oleh app/api/kunjungan (absen keluar) dan
// app/api/kunjungan/tutup-otomatis (potong otomatis jam 17:00).

// Kunjungan yang lebih pendek dari ini dianggap tidak sah — sekadar mampir,
// bukan mengawasi.
export const DURASI_MINIMUM_MENIT = 10;

// ---- Pemantauan di tengah kunjungan (lihat supabase/add_kunjungan_pantau.sql)

// Seberapa sering kartu kunjungan mengirim posisi selama aplikasi terbuka.
// 3 menit itu kompromi: cukup rapat untuk menangkap orang yang pergi sebentar,
// cukup jarang supaya GPS tidak menyala terus-menerus dan menghabiskan baterai
// HP yang dipakai kerja seharian.
export const INTERVAL_HEARTBEAT_MENIT = 3;

// Spot-check baru boleh diminta setelah kunjungan seumur ini. Sebelum itu
// orangnya masih mungkin sedang berjalan dari parkiran, dan lagipula kunjungan
// sependek ini sudah gugur sendiri lewat DURASI_MINIMUM_MENIT.
export const USIA_MIN_SPOTCHECK_MENIT = 10;

// Berapa lama supervisor punya waktu membuka aplikasi dan mengirim posisinya
// setelah notifikasi masuk. Harus longgar — HP di saku, sinyal proyek jelek, dan
// yang dihukum di sini seharusnya orang yang mengabaikan, bukan orang yang
// telat lihat notifikasi.
export const BATAS_JAWAB_SPOTCHECK_MENIT = 10;

// Jeda minimum antar spot-check dalam satu kunjungan, plus batas atasnya.
// Tanpa keduanya, kunjungan seharian penuh bisa menerima belasan push dan
// berubah dari pengawasan jadi gangguan.
export const JEDA_ANTAR_SPOTCHECK_MENIT = 30;
export const MAKS_SPOTCHECK_PER_KUNJUNGAN = 2;

// Peluang seorang supervisor kena spot-check pada satu putaran penjadwal.
//
// Sengaja acak, bukan "tepat di menit ke-30": begitu waktunya bisa ditebak,
// yang diukur bukan lagi kehadiran melainkan kemampuan menebak jadwal. Dengan
// penjadwal tiap 5 menit, 0,25 memberi cek pertama rata-rata sekitar 20 menit
// setelah kunjungan memenuhi syarat.
export const PELUANG_SPOTCHECK = 0.25;

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
export function nilaiKunjungan({
  menit,
  jarakKeluar = null,
  radiusMeter = null,
  pantauDiLuar = 0,
  spotcheckTerlewat = 0,
}) {
  const alasan = [];

  if (jarakKeluar != null && radiusMeter != null && jarakKeluar > radiusMeter)
    alasan.push(`Absen keluar dari ${Math.round(jarakKeluar)}m di luar radius ${radiusMeter}m.`);

  // Pemantauan di tengah kunjungan. Dua pelanggaran ini dipisah karena
  // artinya berbeda dan Master perlu bisa membedakannya: "terdeteksi di luar"
  // berarti aplikasinya terbuka dan posisinya memang di luar radius,
  // sedangkan "tidak menjawab" berarti tidak ada posisi sama sekali — bisa
  // karena pergi, bisa karena HP mati. Digabung jadi satu kalimat, keduanya
  // terbaca sama beratnya padahal tidak.
  if (pantauDiLuar > 0)
    alasan.push(`Terdeteksi ${pantauDiLuar}× di luar radius saat kunjungan berlangsung.`);

  if (spotcheckTerlewat > 0)
    alasan.push(`${spotcheckTerlewat} permintaan konfirmasi lokasi tidak dijawab.`);

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
