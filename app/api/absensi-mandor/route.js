import { getSessionProfile } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/absensi-mandor?bulan=2026-07
// Ambil checkin_harian mandor berdasarkan user.id, hitung hari absen.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bulan = searchParams.get("bulan");
  if (!bulan) return NextResponse.json({ checkin: [] });

  const { user, supabase } = await getSessionProfile();
  if (!user) return NextResponse.json({ checkin: [] });

  const [yr, mo] = bulan.split("-").map(Number);
  const start = `${bulan}-01`;
  const nextMonth = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${String(mo + 1).padStart(2, "0")}-01`;

  const { data: checkin } = await supabase
    .from("checkin_harian")
    .select("tanggal")
    .eq("chat_id", user.id)
    .gte("tanggal", start)
    .lt("tanggal", nextMonth);

  return NextResponse.json({ checkin: checkin || [] });
}
