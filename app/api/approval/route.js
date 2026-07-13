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

  // Kasbon (diajukan Supervisor sendiri) cuma boleh disetujui Master —
  // biar Supervisor tidak menyetujui pengajuan kasbon miliknya sendiri,
  // walau RLS keuangan_review teknisnya mengizinkan (dia pemilik proyek).
  if (tipe === "keuangan") {
    const { data: row } = await supabase.from("keuangan").select("jenis").eq("id", id).maybeSingle();
    if (row?.jenis === "KASBON" && profile.role !== "MASTER")
      return NextResponse.json({ error: "Kasbon hanya bisa disetujui Master." }, { status: 403 });
  }

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
