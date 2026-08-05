import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

// POST /api/perbaikan/notify-bukti — dipanggil dari PerbaikanMandorList
// setelah Mandor kirim bukti pengerjaan, buat push notification browser
// ke Supervisor proyek tsb (bukan Telegram, khusus alur ini). Sama seperti
// /api/notify: gagal di sini tidak menandakan bukti gagal terkirim — data
// checklist sudah tersimpan sebelum ini dipanggil, endpoint ini pelengkap.
// body: { proyek_id, uraian }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const { proyek_id, uraian } = await req.json();
  if (!proyek_id) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: proyek } = await supabase
    .from("proyek")
    .select("supervisor_id")
    .eq("id", proyek_id)
    .maybeSingle();
  if (!proyek?.supervisor_id) return NextResponse.json({ ok: false });

  const ok = await sendPush(proyek.supervisor_id, {
    title: "Bukti pengerjaan baru",
    body: `${profile.name}${uraian ? `: ${uraian}` : ""}`,
    url: "/supervisor/perbaikan",
  });

  return NextResponse.json({ ok });
}
