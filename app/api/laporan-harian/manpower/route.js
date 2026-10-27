import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { KLASIFIKASI_MANPOWER } from "@/lib/manpower";

export const dynamic = "force-dynamic";

const hariIni = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const angka = (v) => (Number(v) > 0 ? Math.min(Math.floor(Number(v)), 999) : 0);

// GET /api/laporan-harian/manpower?proyek_id=...[&tanggal=YYYY-MM-DD]
// Man Power satu proyek (default hari ini). RLS menentukan akses.
export async function GET(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proyekId = searchParams.get("proyek_id");
  const tanggal = searchParams.get("tanggal") || hariIni();
  if (!proyekId) return NextResponse.json({ error: "proyek_id wajib diisi." }, { status: 400 });

  const { data, error } = await supabase
    .from("laporan_manpower")
    .select("klasifikasi, aktif_site, aktif_ws, lembur, alpha")
    .eq("proyek_id", proyekId)
    .eq("tanggal", tanggal);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, rows: data || [] });
}

// PUT /api/laporan-harian/manpower — simpan Man Power HARI INI satu proyek.
// body: { proyek_id, rows: [{ klasifikasi, aktif_site, aktif_ws, lembur, alpha }] }
// Baris yang semua angkanya 0 dihapus, sisanya di-upsert.
export async function PUT(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["SUPERVISOR", "MASTER"].includes(profile.role))
    return NextResponse.json({ error: "Hanya Supervisor atau Master." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const proyekId = body.proyek_id;
  if (!proyekId || !Array.isArray(body.rows))
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });

  const tanggal = hariIni();
  const isi = [];
  const kosong = [];
  for (const r of body.rows) {
    if (!KLASIFIKASI_MANPOWER.includes(r.klasifikasi)) continue;
    const baris = {
      proyek_id: proyekId,
      tanggal,
      klasifikasi: r.klasifikasi,
      aktif_site: angka(r.aktif_site),
      aktif_ws: angka(r.aktif_ws),
      lembur: angka(r.lembur),
      alpha: angka(r.alpha),
    };
    if (baris.aktif_site || baris.aktif_ws || baris.lembur || baris.alpha)
      isi.push({ ...baris, created_by: profile.id, updated_at: new Date().toISOString() });
    else kosong.push(r.klasifikasi);
  }

  if (kosong.length) {
    const { error } = await supabase
      .from("laporan_manpower")
      .delete()
      .eq("proyek_id", proyekId)
      .eq("tanggal", tanggal)
      .in("klasifikasi", kosong);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (isi.length) {
    const { error } = await supabase
      .from("laporan_manpower")
      .upsert(isi, { onConflict: "proyek_id,tanggal,klasifikasi" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
