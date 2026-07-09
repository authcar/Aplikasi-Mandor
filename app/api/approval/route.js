import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// POST /api/approval
// body: { tipe: 'lembur'|'keuangan', id: uuid, aksi: 'APPROVED'|'REJECTED' }
// SUPERVISOR & MASTER. RLS di DB jadi lapis pertahanan kedua.
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPERVISOR", "MASTER"].includes(profile.role))
    return NextResponse.json({ error: "Hanya Supervisor/Master" }, { status: 403 });

  const { tipe, id, aksi } = await req.json();
  if (!["lembur", "keuangan"].includes(tipe) || !id)
    return NextResponse.json({ error: "Param salah" }, { status: 400 });
  if (!["APPROVED", "REJECTED"].includes(aksi))
    return NextResponse.json({ error: "Aksi salah" }, { status: 400 });

  const { data, error } = await supabase
    .from(tipe)
    .update({
      status: aksi,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "PENDING") // cegah double-review
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)
    return NextResponse.json({ error: "Sudah diproses / tidak ditemukan" }, { status: 409 });

  return NextResponse.json({ ok: true, data });
}
