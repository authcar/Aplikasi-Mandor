import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { koordinatValid } from "@/lib/geo";
import { proyekTerdekat } from "@/lib/proyekTerdekat";

// GET /api/absensi-pegawai/lokasi?lat=..&lng=..
// Nama proyek terdekat + alamat untuk dicetak di stempel selfie. Hanya label tampilan;
// angka yang disimpan tetap dihitung ulang di POST /api/absensi-pegawai.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Alamat dari Google Geocoding API. Kuncinya (GOOGLE_MAPS_API_KEY) hanya ada di
// server, jadi tidak pernah sampai ke browser. Tanpa kunci / gagal / kuota habis
// -> null, stempel tetap jalan dengan koordinat saja.
//
// Cache per titik dibulatkan 4 desimal (~11 m): klien sudah menahan permintaan
// sampai berpindah 50 m, ini menahan sisanya (beberapa pegawai di kantor yang
// sama, buka-tutup modal) supaya tidak menambah tagihan.
const ALAMAT_CACHE_MAKS = 500;
const alamatCache = new Map();

async function cariAlamat(lat, lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const kunci = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (alamatCache.has(kunci)) return alamatCache.get(kunci);

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
    const alamat = hasil?.formatted_address?.replace(/,\s*Indonesia$/, "").replace(/,\s*Daerah Khusus Ibukota Jakarta$/, ", DKI Jakarta") || null;

    if (alamatCache.size >= ALAMAT_CACHE_MAKS) alamatCache.delete(alamatCache.keys().next().value);
    alamatCache.set(kunci, alamat);
    return alamat;
  } catch {
    return null;
  }
}

export async function GET(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!koordinatValid(lat, lng)) return NextResponse.json({ proyek: null, alamat: null });

  const [proyek, alamat] = await Promise.all([
    proyekTerdekat(supabaseAdmin, lat, lng),
    cariAlamat(lat, lng),
  ]);
  return NextResponse.json({ proyek, alamat });
}
