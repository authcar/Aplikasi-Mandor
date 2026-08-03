import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

// POST /api/masalah
// body: { id: uuid, status: 'OPEN'|'IN_PROGRESS'|'DONE' }
// SUPERVISOR, MASTER & FINANCE. RLS di DB jadi lapis pertahanan kedua.
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPERVISOR", "MASTER", "FINANCE"].includes(profile.role))
    return NextResponse.json({ error: "Hanya Supervisor/Master/Finance" }, { status: 403 });

  const { id, status } = await req.json();
  if (!id) return NextResponse.json({ error: "Param salah" }, { status: 400 });
  if (!["OPEN", "IN_PROGRESS", "DONE"].includes(status))
    return NextResponse.json({ error: "Status salah" }, { status: 400 });

  const { data, error } = await supabase
    .from("masalah")
    .update({ status, dibaca_pelapor: false })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "Diproses", DONE: "Selesai" };
  await sendPush(data.created_by, {
    title: `Laporan masalah: ${STATUS_LABEL[status]}`,
    body: data.judul,
    url: "/",
  }).catch(() => {});

  return NextResponse.json({ ok: true, data });
}
