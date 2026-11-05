import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { buatPdfLaporanHarian } from "@/lib/laporanHarianPdf";
import { createTaracoClient } from "@/lib/supabase/taraco";
import { identitasProyek } from "@/lib/laporanProyek";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLE_BOLEH = ["MASTER", "FINANCE", "SUPERVISOR", "HEAD_OF_PRODUCTION"];

// RLS laporan_harian tidak mengenal HEAD_OF_PRODUCTION, jadi role itu membaca
// lewat service role (hanya baca; role sudah dicek di GET).
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const FOTO_MAKS_BYTE = 8 * 1024 * 1024;

// SPK = projects.code, Client = projects.client di Taraco (proyek tracker:
// portal_proyek.kode / klien_nama, lihat identitasProyek). Tidak pernah melempar: gagal = null, kop PDF menampilkan "-".
async function ambilDariTaraco(taracoId) {
  if (!taracoId) return null;
  try {
    const { data } = await createTaracoClient().from("projects").select("code, client").eq("id", taracoId).maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

// GET /api/laporan-harian/pdf?proyek_id=...&tanggal=YYYY-MM-DD
// PDF laporan harian satu proyek pada satu hari. Query lewat client user,
// jadi RLS menentukan apa yang boleh dilihat (Supervisor hanya proyeknya).
export async function GET(req) {
  const { profile, supabase: supabaseUser } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ROLE_BOLEH.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  const supabase = profile.role === "HEAD_OF_PRODUCTION" ? supabaseAdmin : supabaseUser;

  const { searchParams } = new URL(req.url);
  const proyekId = searchParams.get("proyek_id");
  const tanggal = searchParams.get("tanggal");
  if (!proyekId || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal || ""))
    return NextResponse.json({ error: "proyek_id dan tanggal wajib diisi." }, { status: 400 });

  const { data: rows, error } = await supabase
    .from("laporan_harian")
    .select("id, deskripsi, status, foto_url, created_at, created_by, proyek:proyek_id(nama, lokasi, taraco_id, portal_id, supervisor:supervisor_id(name))")
    .eq("proyek_id", proyekId)
    .eq("tanggal", tanggal)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!rows?.length)
    return NextResponse.json({ error: "Tidak ada laporan pada tanggal itu." }, { status: 404 });

  // Unduh foto satu per satu supaya memori tidak menumpuk; foto yang gagal
  // diunduh/terlalu besar tetap dicatat di PDF sebagai "tidak dapat ditampilkan".
  const items = [];
  for (const r of rows) {
    let foto = null;
    if (r.foto_url) {
      const { data: blob } = await supabase.storage.from("progres").download(r.foto_url);
      if (blob && blob.size <= FOTO_MAKS_BYTE) foto = new Uint8Array(await blob.arrayBuffer());
      else foto = new Uint8Array(1);
    }
    items.push({ status: r.status, deskripsi: r.deskripsi, foto });
  }

  // "Diajukan Oleh" = yang membuat laporan hari itu (bisa Supervisor atau Head of
  // Production), bukan supervisor yang tertera di proyek: proyek tanpa
  // supervisor, atau laporan buatan Head of Production, akan kosong. Nama dibaca
  // lewat service role karena RLS profiles tidak membuka semua role. Gagal =
  // jatuh ke supervisor proyek.
  const pembuatIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  const pembuat = pembuatIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", pembuatIds)
        .then(({ data }) => pembuatIds.map((id) => data?.find((p) => p.id === id)?.name).filter(Boolean).join(", "))
        .catch(() => "")
    : "";

  // Man Power (tabel laporan_manpower), SPK & Client (Taraco: code, client),
  // dan logo. Semuanya pelengkap: kalau gagal dibaca, bagian itu kosong/"-"
  // dan PDF tetap jadi.
  const [{ data: manpower }, taraco, logo] = await Promise.all([
    supabase
      .from("laporan_manpower")
      .select("klasifikasi, aktif_site, aktif_ws, lembur, alpha")
      .eq("proyek_id", proyekId)
      .eq("tanggal", tanggal),
    identitasProyek(rows[0].proyek, ambilDariTaraco),
    fetch(new URL("/logo.png", req.url))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Uint8Array(b) : null))
      .catch(() => null),
  ]);

  const namaProyek = rows[0].proyek?.nama || "Proyek";
  let pdf;
  try {
    pdf = buatPdfLaporanHarian({
      proyek: namaProyek,
      lokasi: rows[0].proyek?.lokasi || null,
      supervisor: pembuat || rows[0].proyek?.supervisor?.name || null,
      tanggal,
      items,
      spk: taraco?.code || null,
      client: taraco?.client && taraco.client !== "-" ? taraco.client : null,
      manpower: manpower || [],
      logo,
    });
  } catch (e) {
    console.error("laporan-harian/pdf gagal:", e?.message);
    return NextResponse.json({ error: "Gagal membuat PDF." }, { status: 500 });
  }

  const namaFile = `Laporan Harian - ${namaProyek} - ${tanggal}.pdf`.replace(/[^\w .()-]/g, "").replace(/\s+/g, " ");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${namaFile}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
