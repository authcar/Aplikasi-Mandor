import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

// POST /api/perbaikan/notify-review — dipanggil dari PerbaikanForm
// (Supervisor) setelah menyetujui/menolak bukti pengerjaan, buat push
// notification browser ke Mandor yang bersangkutan. Target-nya
// assigned_mandor_id kalau item ini di-assign manual, kalau tidak SEMUA
// mandor proyek tsb (proyek_mandor — 1 proyek bisa dipegang >1 mandor,
// lihat lib/supabase/proyekMandor.js), sama seperti pola visibilitas di
// supabase/add_checklist_assigned_mandor.sql. proyek.mandor_id tetap ikut
// di-OR supaya proyek lokal manual yang tidak punya baris proyek_mandor
// tetap kebagian. Sama seperti /api/notify:
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
    .select("uraian, proyek_id, assigned_mandor_id, proyek:proyek_id(mandor_id)")
    .eq("id", id)
    .maybeSingle();

  let target = [];
  if (item?.assigned_mandor_id) {
    target = [item.assigned_mandor_id];
  } else if (item?.proyek_id) {
    const { data: pasangan } = await supabase
      .from("proyek_mandor")
      .select("mandor_id")
      .eq("proyek_id", item.proyek_id);
    target = [
      ...new Set([...(pasangan || []).map((r) => r.mandor_id), item?.proyek?.mandor_id].filter(Boolean)),
    ];
  }
  if (!target.length) return NextResponse.json({ ok: false });

  const ok = await sendPush(target, {
    title: status === "DONE" ? "Bukti pengerjaan disetujui" : "Bukti pengerjaan ditolak",
    body: `${item.uraian}${status === "OPEN" && alasan ? ` — ${alasan}` : ""}`,
    url: "/mandor/perbaikan",
  });

  return NextResponse.json({ ok });
}
