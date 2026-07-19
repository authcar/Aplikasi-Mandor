import { getSessionProfile } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bulan = searchParams.get("bulan"); // format: "2026-06"

  if (!bulan) return NextResponse.json({ potongan: [], checkin: [], laporan: [] });

  const { user, profile, supabase } = await getSessionProfile();
  if (!user) return NextResponse.json({ potongan: [], checkin: [], laporan: [] });

  const chatId = profile?.telegram_chat_id;
  if (!chatId) return NextResponse.json({ potongan: [], checkin: [], laporan: [] });

  const [yr, mo] = bulan.split("-").map(Number);
  const start = `${bulan}-01`;
  const nextMonth = mo === 12 ? `${yr + 1}-01-01` : `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
  const chatIdStr = String(chatId);

  const [{ data: potongan }, { data: checkin }, { data: laporan }] = await Promise.all([
    supabase
      .from("potongan_gaji")
      .select("tanggal")
      .eq("chat_id", chatIdStr)
      .gte("tanggal", start)
      .lt("tanggal", nextMonth),
    // checkin_harian: sumber lama (bot Telegram), tetap diambil sebagai fallback.
    supabase
      .from("checkin_harian")
      .select("tanggal")
      .eq("chat_id", chatIdStr)
      .gte("tanggal", start)
      .lt("tanggal", nextMonth),
    // laporan_harian: sumber utama sekarang, laporan manual milik supervisor ini.
    supabase
      .from("laporan_harian")
      .select("tanggal")
      .eq("created_by", profile.id)
      .gte("tanggal", start)
      .lt("tanggal", nextMonth),
  ]);

  return NextResponse.json({ potongan: potongan || [], checkin: checkin || [], laporan: laporan || [] });
}
