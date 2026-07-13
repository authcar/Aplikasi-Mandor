import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { notifySupervisor, notifyMaster } from "@/lib/notify";

// POST /api/keuangan — Input Reimburse (siapa saja) atau Kasbon (khusus
// Supervisor, disetujui Master, lihat /api/approval). Menerima
// multipart/form-data:
//   proyek_id, jenis(REIMBURSE|KASBON), nominal, keterangan, tukang_id?, nota(File?)
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const proyek_id = form.get("proyek_id");
  const jenis = form.get("jenis");
  const nominal = Number(form.get("nominal"));
  const keterangan = form.get("keterangan") || null;
  const tukang_id = form.get("tukang_id") || null;
  const nota = form.get("nota"); // File | null

  if (!proyek_id || !["REIMBURSE", "KASBON"].includes(jenis) || !nominal)
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  if (jenis === "KASBON" && profile.role !== "SUPERVISOR")
    return NextResponse.json({ error: "Kasbon hanya bisa diajukan Supervisor." }, { status: 403 });

  let nota_url = null;
  if (nota && typeof nota === "object" && nota.size > 0) {
    const ext = (nota.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${proyek_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("nota")
      .upload(path, nota, { contentType: nota.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    nota_url = path;
  }

  const { data, error } = await supabase
    .from("keuangan")
    .insert({
      proyek_id,
      tukang_id,
      jenis,
      nominal,
      keterangan,
      nota_url,
      created_by: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (jenis === "KASBON") {
    await notifyMaster({
      tipe: "kasbon",
      namaPengaju: profile.name,
      ringkasan: `${keterangan || "Kasbon"} — Rp${nominal.toLocaleString("id-ID")}`,
    }).catch(() => {});
  } else {
    await notifySupervisor({
      supabase,
      proyek_id,
      tipe: "keuangan",
      namaPengaju: profile.name,
      ringkasan: `${keterangan || "Reimburse"} — Rp${nominal.toLocaleString("id-ID")}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, data });
}
