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
