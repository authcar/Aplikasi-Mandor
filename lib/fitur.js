// Saklar fitur untuk menu/ikon di aplikasi (Home & tab bar semua peran).
//
// `false` = disembunyikan dari menu, BUKAN dihapus: halaman, API, dan datanya
// tetap ada. Untuk memunculkan lagi, cukup ubah jadi `true`.
//
// Catatan: ini hanya menyembunyikan tautan di menu. Alamat halamannya sendiri
// (mis. /master/gaji) masih bisa dibuka kalau diketik langsung.
export const FITUR = {
  // ---- Ditampilkan ----
  laporanHarian: true,
  absensiPegawai: true,
  defectList: true, // menu "Perbaikan" / "Defect List"
  projectTracker: true, // /portal

  // ---- Disembunyikan sementara ----
  persetujuan: false, // Menunggu Persetujuan + tab "Laporan" (lembur, kasbon, reimburse)
  gaji: false, // tab Dompet / Nilai Jasa / Rekap Gaji
  absensiTim: false, // Absensi Tukang / Lihat Absensi / roll call
  kunjungan: false, // Kunjungan Supervisor
  kasbon: false,
  reimburse: false,
  kurangMaterial: false,
  lembur: false,
  kelolaAkun: false,
  biayaProyek: false, // Biaya Proyek / Biaya & Profit
  aturBudget: false,
  proyekTanpaMandor: false,
  nilaiProyek: false, // kartu Nilai Jasa Pekerja & Sisa Budget di Home Mandor
  streak: false, // widget "rajin lapor" di Home Supervisor
  absensiSaya: false, // kartu absen masuk/pulang di Home Tukang Harian
  daftarProyek: false, // daftar "Proyek Saya" di Home Supervisor/Master/Finance
};

export const fiturAktif = (kunci) => FITUR[kunci] === true;
