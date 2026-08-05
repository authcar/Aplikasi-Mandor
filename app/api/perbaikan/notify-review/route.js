import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

// POST /api/perbaikan/notify-review — dipanggil dari PerbaikanForm
// (Supervisor) setelah menyetujui/menolak bukti pengerjaan, buat push
// notification browser ke Mandor yang bersangkutan. Target-nya
// assigned_mandor_id kalau item ini di-assign manual, kalau tidak fallback
// ke proyek.mandor_id (sama seperti pola visibilitas di
// supabase/add_checklist_assigned_mandor.sql). Sama seperti /api/notify:
// gagal di sini tidak menandakan status gagal tersimpan — data checklist
// sudah tersimpan sebelum ini dipanggil, endpoint ini pelengkap.
// body: { id, status: 'DONE'|'OPEN', alasan? }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const { id, status, alasan } = await req.json();
  if (!id || !["DONE", "OPEN"].includes(status))
    return NextResponse.json({ ok: false }, { status: 400 });

  const { data: item } = await supabase
    .from("checklist_perbaikan")
    .select("uraian, assigned_mandor_id, proyek:proyek_id(mandor_id)")
    .eq("id", id)
    .maybeSingle();

  const targetMandorId = item?.assigned_mandor_id || item?.proyek?.mandor_id;
  if (!targetMandorId) return NextResponse.json({ ok: false });

  const ok = await sendPush(targetMandorId, {
    title: status === "DONE" ? "Bukti pengerjaan disetujui" : "Bukti pengerjaan ditolak",
    body: `${item.uraian}${status === "OPEN" && alasan ? ` — ${alasan}` : ""}`,
    url: "/mandor/perbaikan",
  });

  return NextResponse.json({ ok });
}
