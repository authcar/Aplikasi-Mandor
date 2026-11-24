// Saklar fitur untuk menu/ikon di aplikasi — saat ini HANYA dipakai peran MASTER
// (Home + tab bar + detail proyek). Peran lain tampil lengkap seperti biasa.
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

  // ---- Disembunyikan sementara (Master) ----
  persetujuan: false, // Menunggu Persetujuan + tab "Laporan"
  gaji: false, // tab Nilai Jasa
  absensiTim: false, // Lihat Absensi + notifikasi "Belum absen"
  kunjungan: false, // Kunjungan SPV
  kelolaAkun: false,
  biayaProyek: false, // Biaya Proyek / Biaya & Profit
  proyekTanpaMandor: false, // notifikasi "Belum ada Mandor"
  daftarProyek: false, // daftar "Proyek Saya"
  absensiSaya: false, // kartu "Absensi Saya" (absen masuk/pulang sendiri) di Home Master
};

export const fiturAktif = (kunci) => FITUR[kunci] === true;
