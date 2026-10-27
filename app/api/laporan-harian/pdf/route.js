import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { buatPdfLaporanHarian, hitungManPower } from "@/lib/laporanHarianPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROLE_BOLEH = ["MASTER", "FINANCE", "SUPERVISOR"];
const FOTO_MAKS_BYTE = 8 * 1024 * 1024;

// GET /api/laporan-harian/pdf?proyek_id=...&tanggal=YYYY-MM-DD
// PDF laporan harian satu proyek pada satu hari. Query lewat client user,
// jadi RLS menentukan apa yang boleh dilihat (Supervisor hanya proyeknya).
export async function GET(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ROLE_BOLEH.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const proyekId = searchParams.get("proyek_id");
  const tanggal = searchParams.get("tanggal");
  if (!proyekId || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal || ""))
    return NextResponse.json({ error: "proyek_id dan tanggal wajib diisi." }, { status: 400 });

  const { data: rows, error } = await supabase
    .from("laporan_harian")
    .select("id, deskripsi, status, foto_url, created_at, proyek:proyek_id(nama, lokasi, supervisor:supervisor_id(name))")
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

  // Man Power dari absensi tim hari itu; kalau gagal dibaca, tabelnya kosong
  // (laporan tetap jadi). Logo diambil dari aset publik aplikasi sendiri.
  const [{ data: absensi }, logo] = await Promise.all([
    supabase.from("absensi_tim").select("tim, jumlah").eq("proyek_id", proyekId).eq("tanggal", tanggal),
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
      supervisor: rows[0].proyek?.supervisor?.name || null,
      tanggal,
      items,
      manpower: hitungManPower(absensi || []),
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
