import { hitungJarak } from "@/lib/geo";

// Nama proyek aktif yang titiknya paling dekat dengan koordinat ini, selama
// masih di dalam radius proyek itu sendiri. null kalau tidak ada.
//
// Hanya LABEL untuk absen pegawai — hasilnya tidak pernah dipakai menolak
// absen, karena pegawai boleh berpindah antar proyek seharian. Proyek yang
// belum punya titik (lat/lng null) otomatis tidak ikut dihitung.
//
// `admin` = client service role: pegawai biasa tidak punya akses baca ke
// semua proyek lewat RLS, sedangkan label ini harus bisa muncul di mana pun.
export async function proyekTerdekat(admin, lat, lng) {
  const { data } = await admin
    .from("proyek")
    .select("nama, lat, lng, radius_meter")
    .eq("is_active", true)
    .not("lat", "is", null)
    .not("lng", "is", null);

  let terbaik = null;
  for (const p of data || []) {
    const jarak = hitungJarak(lat, lng, p.lat, p.lng);
    if (jarak > (p.radius_meter || 300)) continue;
    if (!terbaik || jarak < terbaik.jarak) terbaik = { nama: p.nama, jarak };
  }
  return terbaik ? terbaik.nama : null;
}
