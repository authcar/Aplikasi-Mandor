import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { ROLE_LAPOR, klienLaporan, supabaseAdmin } from "@/lib/laporanAkses";

const STATUS_VALID = ["ON_PROGRESS", "DONE", "PERBAIKAN"];

// POST /api/laporan-harian — Laporan Harian Supervisor / Head of Production
// (foto + deskripsi + status).
// Menerima multipart/form-data: proyek_id, deskripsi, status, foto(File?)
export async function POST(req) {
  const { profile, supabase: supabaseUser } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ROLE_LAPOR.includes(profile.role))
    return NextResponse.json({ error: "Hanya Supervisor atau Head of Production." }, { status: 403 });
  const supabase = klienLaporan(profile, supabaseUser);

  const form = await req.formData();
  const proyek_id = form.get("proyek_id");
  const deskripsi = (form.get("deskripsi") || "").toString().trim();
  const status = form.get("status");
  const foto = form.get("foto"); // File | null

  if (!proyek_id || !deskripsi || !STATUS_VALID.includes(status))
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });

  // Supervisor dibatasi RLS ke proyeknya; Head of Production melewati RLS,
  // jadi cukup dipastikan proyeknya memang ada dan aktif.
  if (profile.role === "HEAD_OF_PRODUCTION") {
    const { data: ada } = await supabaseAdmin
      .from("proyek")
      .select("id")
      .eq("id", proyek_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!ada) return NextResponse.json({ error: "Proyek tidak ditemukan atau sudah tidak aktif." }, { status: 404 });
  }

  let foto_url = null;
  if (foto && typeof foto === "object" && foto.size > 0) {
    const ext = (foto.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${proyek_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("progres")
      .upload(path, foto, { contentType: foto.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    foto_url = path;
  }

  const { data, error } = await supabase
    .from("laporan_harian")
    .insert({ proyek_id, deskripsi, status, foto_url, created_by: profile.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, data });
}
