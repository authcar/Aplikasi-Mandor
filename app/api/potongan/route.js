import { getSessionProfile } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bulan = searchParams.get("bulan"); // format: "2026-06"

  if (!bulan) return NextResponse.json({ potongan: [], checkin: [] });

  const { user, profile, supabase } = await getSessionProfile();
  if (!user) return NextResponse.json({ potongan: [], checkin: [] });

  const chatId = profile?.telegram_chat_id;
  if (!chatId) return NextResponse.json({ potongan: [], checkin: [] });

  const [yr, mo] = bulan.split("-").map(Number);
  const start = `${bulan}-01`;
  const nextMonth = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
  const chatIdStr = String(chatId);

  const [{ data: potongan }, { data: checkin }] = await Promise.all([
    supabase
      .from("potongan_gaji")
      .select("tanggal")
      .eq("chat_id", chatIdStr)
      .gte("tanggal", start)
      .lt("tanggal", nextMonth),
    supabase
      .from("checkin_harian")
      .select("tanggal")
      .eq("chat_id", chatIdStr)
      .gte("tanggal", start)
      .lt("tanggal", nextMonth),
  ]);

  return NextResponse.json({ potongan: potongan || [], checkin: checkin || [] });
}
