// Alamat dari koordinat lewat Google Geocoding API. Dipakai stempel selfie
// (app/api/absensi-pegawai/lokasi) dan penyimpanan absen (app/api/absensi-pegawai).
//
// Kuncinya (GOOGLE_MAPS_API_KEY) hanya ada di server. Tanpa kunci / gagal /
// kuota habis -> null; pemanggil tetap jalan dengan koordinat saja.
//
// Cache per titik dibulatkan 4 desimal (~11 m) supaya beberapa pegawai di
// tempat yang sama tidak menambah tagihan.
const CACHE_MAKS = 500;
const cache = new Map();

export async function cariAlamat(lat, lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const kunci = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(kunci)) return cache.get(kunci);

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?latlng=${lat},${lng}&language=id&region=id&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = await res.json();
    if (j.status !== "OK") return null;

    // Lewati hasil berupa Plus Code ("7Q5X+4M Jakarta") — tidak berguna dibaca orang.
    const hasil = j.results.find((r) => !r.types?.includes("plus_code"));
    const alamat =
      hasil?.formatted_address
        ?.replace(/,\s*Indonesia$/, "")
        .replace(/,\s*Daerah Khusus Ibukota Jakarta$/, ", DKI Jakarta") || null;

    if (cache.size >= CACHE_MAKS) cache.delete(cache.keys().next().value);
    cache.set(kunci, alamat);
    return alamat;
  } catch {
    return null;
  }
}
