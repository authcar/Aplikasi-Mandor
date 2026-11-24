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
};

export const fiturAktif = (kunci) => FITUR[kunci] === true;
