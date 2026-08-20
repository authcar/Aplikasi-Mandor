// Helper jarak geografis — dipakai bareng server & client.
//
// Awalnya fungsi ini hidup di dalam components/AbsensiSayaCard.jsx dan cuma
// dipanggil di browser. Sejak absensi kunjungan Supervisor memvalidasi lokasi
// DI SERVER (app/api/kunjungan/route.js), rumusnya harus bisa diimpor dari
// dua sisi — makanya dipindah ke sini. File ini sengaja tanpa "use client"
// dan tanpa dependensi apa pun.

// Jarak dua titik lat/lng dalam METER (haversine).
export function hitungJarak(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Koordinat yang masuk akal? Dipakai server buat menolak payload ngawur
// sebelum dihitung jaraknya (client bisa mengirim apa saja).
export function koordinatValid(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // 0,0 itu di Teluk Guinea — praktis selalu berarti GPS gagal, bukan
    // lokasi sungguhan.
    !(lat === 0 && lng === 0)
  );
}

// Ambil lat/lng dari teks yang ditempel orang.
//
// Master menetapkan titik proyek dengan menempel koordinat dari Google Maps,
// dan yang tersalin ke clipboard bentuknya tidak selalu sama:
//   • klik kanan di peta  -> "-6.215008, 106.736006"
//   • salin alamat bar    -> "https://www.google.com/maps/@-6.215008,106.736006,17z"
//   • bagikan lokasi      -> "https://maps.google.com/?q=-6.215008,106.736006"
//
// Ketiganya diterima. Pola @lat,lng dicoba DULUAN karena URL Google Maps juga
// mengandung angka berkoma lain (tingkat zoom, id tempat) yang bisa tertangkap
// duluan oleh pola umum dan menghasilkan titik ngawur tanpa terlihat salah.
export function uraikanKoordinat(teks) {
  const s = String(teks || "").trim();
  if (!s) return null;

  const cocok = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ||
    s.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!cocok) return null;

  const lat = Number(cocok[1]);
  const lng = Number(cocok[2]);
  return koordinatValid(lat, lng) ? { lat, lng } : null;
}

// Kotak kasar wilayah Indonesia, dipakai HANYA sebagai penangkap salah tempel
// yang KASAR. Bukan validasi wilayah — kotaknya persegi, jadi banyak laut ikut
// masuk dan tidak ada niat memperbaikinya: poligon kepulauan tidak sebanding
// dengan yang mau dicegah di sini.
//
// Yang tertangkap: koordinat dari negara lain (salah salin), bujur yang
// kehilangan tanda, dan lintang/bujur tertukar yang lolos koordinatValid.
// Yang TIDAK tertangkap: lintang yang kehilangan tanda dekat khatulistiwa —
// -6,106 jadi 6,106 masih di dalam kotak meski sebenarnya di laut lepas.
// Pengaman terakhir untuk kasus itu manusia: koordinat yang tersimpan
// ditampilkan balik di kartu titik proyek, dan Master bisa langsung
// membandingkannya dengan yang dia tempel.
//
// Ini pantas ada meski bolong, karena titik proyek yang salah mewarisi
// error-nya ke SEMUA kunjungan sesudahnya — ketahuannya baru setelah absen
// orang ditolak berhari-hari.
export function dalamIndonesia(lat, lng) {
  return lat >= -11.5 && lat <= 6.5 && lng >= 94.5 && lng <= 141.5;
}
