import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { koordinatValid } from "@/lib/geo";
import { proyekTerdekat } from "@/lib/proyekTerdekat";
import { cariAlamat } from "@/lib/geocode";

// GET /api/absensi-pegawai/lokasi?lat=..&lng=..
// Nama proyek terdekat + alamat untuk dicetak di stempel selfie. Hanya label
// tampilan; angka yang disimpan dihitung ulang di POST /api/absensi-pegawai.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
