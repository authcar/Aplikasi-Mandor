import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { ROLE_LAPOR, klienLaporan } from "@/lib/laporanAkses";
import { proyekHop } from "@/lib/supabase/proyekHop";
import { fileFoto, kolomFoto, MAKS_FOTO_KEGIATAN } from "@/lib/laporanFoto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const STATUS_VALID = ["ON_PROGRESS", "DONE", "PERBAIKAN"];

// Bucket 'progres' tidak punya policy hapus untuk user biasa; dipakai hanya
// untuk membersihkan upload yang batal di request ini sendiri.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST /api/laporan-harian — Laporan Harian Supervisor / Head of Production
// (foto + deskripsi + status).
// Menerima multipart/form-data: proyek_id, deskripsi, status, foto(File, boleh berulang)
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
  const fotos = fileFoto(form); // satu kegiatan boleh banyak foto

  if (!proyek_id || !deskripsi || !STATUS_VALID.includes(status))
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  if (fotos.length > MAKS_FOTO_KEGIATAN)
    return NextResponse.json({ error: `Maksimal ${MAKS_FOTO_KEGIATAN} foto per kegiatan.` }, { status: 400 });

  // Supervisor dibatasi RLS ke proyeknya; Head of Production melewati RLS,
  // jadi dipastikan proyeknya termasuk yang dipegangnya (Kick Off Meeting atau
  // Production di Taraco).
  if (profile.role === "HEAD_OF_PRODUCTION") {
    if (!(await proyekHop()).has(proyek_id))
      return NextResponse.json({ error: "Proyek tidak ditemukan atau bukan proyek Kick Off Meeting/Production." }, { status: 404 });
  }

  // Upload berurutan (urutan = urutan di PDF). Satu gagal -> yang sudah naik
  // dibuang lagi, supaya kirim ulang tidak menumpuk file yatim.
  const paths = [];
  const buangUpload = () => (paths.length ? supabaseAdmin.storage.from("progres").remove(paths).catch(() => {}) : null);
  for (const foto of fotos) {
    const ext = (foto.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${proyek_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("progres")
      .upload(path, foto, { contentType: foto.type, upsert: false });
    if (upErr) {
      await buangUpload();
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
    paths.push(path);
  }

  const { data, error } = await supabase
    .from("laporan_harian")
    .insert({ proyek_id, deskripsi, status, ...kolomFoto(paths), created_by: profile.id })
    .select()
    .single();
  if (error) {
    await buangUpload();
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data });
}
