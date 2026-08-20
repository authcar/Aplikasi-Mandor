// Pembacaan payload koordinat + hitung jarak bertoleransi, untuk absen
// kunjungan Supervisor.
//
// Dulu ini tinggal di dalam app/api/kunjungan/route.js karena cuma dua jalur
// yang memakainya (absen masuk & keluar, satu file). Sejak pemantauan di
// tengah kunjungan ditambahkan, jalurnya jadi empat dan tersebar di tiga
// file — dan keempatnya HARUS memakai ambang akurasi yang sama persis.
// Disalin empat kali, ambangnya bisa berubah di satu tempat saja tanpa
// ketahuan, dan absen jadi lebih ketat daripada pantauan (atau sebaliknya)
// tanpa ada yang pernah memutuskan begitu.
import { hitungJarak, koordinatValid } from "@/lib/geo";

// Batas akurasi GPS, bertingkat — bukan satu angka keras.
//
// Akurasi ±X artinya "posisi sebenarnya ada di suatu tempat dalam lingkaran
// X meter dari titik ini". Jadi angkanya cuma berarti kalau dibandingkan
// dengan apa yang sedang diputuskan:
//
//   • > 500 m  : itu bukan fix GPS sama sekali — browser menebak dari IP atau
//                daftar WiFi. Ditolak, tidak ada yang bisa disimpulkan.
//   • set titik: dibatasi lebih ketat, karena error titik acuan diwariskan ke
//                SEMUA kunjungan sesudahnya di proyek itu.
//   • cek radius: dipakai sebagai toleransi (lihat jarakEfektif), bukan
//                penolakan.
export const AKURASI_BUKAN_GPS = 500;
export const AKURASI_MAKS_SET_TITIK = 100;

// Validasi payload koordinat, sama untuk absen masuk, absen keluar, maupun
// pantauan.
export function bacaKoordinat(body) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const akurasi = body?.accuracy == null ? null : Number(body.accuracy);

  if (!koordinatValid(lat, lng)) return { error: "Koordinat tidak valid" };
  if (akurasi != null && (!Number.isFinite(akurasi) || akurasi < 0))
    return { error: "Akurasi tidak valid" };
  if (akurasi != null && akurasi > AKURASI_BUKAN_GPS)
    return {
      error:
        `Lokasi tidak akurat (±${Math.round(akurasi)}m). Ini biasanya berarti GPS mati atau ` +
        `Anda memakai laptop — absen kunjungan harus dari HP dengan GPS aktif.`,
    };

  return { lat, lng, akurasi };
}

// Jarak ke titik proyek SETELAH diberi keuntungan sebesar margin error GPS.
//
// Menilai dari jarak mentah membuat orang yang benar-benar berdiri di lokasi
// ikut dihukum setiap kali sinyalnya sedang jelek. Yang dipakai di semua
// keputusan radius adalah angka ini, bukan hasil hitungJarak mentah — jarak
// mentah hanya untuk ditampilkan ke orangnya ("Anda 620m dari X"), karena
// itulah angka yang cocok dengan yang dia lihat di peta.
//
// null kalau proyeknya belum punya titik acuan.
export function jarakEfektif(lat, lng, proyek, akurasi) {
  if (proyek?.lat == null || proyek?.lng == null) return null;
  return Math.max(0, hitungJarak(lat, lng, proyek.lat, proyek.lng) - (akurasi || 0));
}
