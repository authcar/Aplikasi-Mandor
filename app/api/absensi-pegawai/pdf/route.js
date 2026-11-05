import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { ambilArsip, buatPdfBulan, simpanArsip } from "@/lib/absensiPegawaiArsip";
import { BUCKET_ABSENSI, NAMA_BULAN, bulanValid, tanggalWIB } from "@/lib/absensiPegawaiAturan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Mengumpulkan ratusan foto lalu menyusun PDF bisa memakan belasan detik.
export const maxDuration = 60;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ROLE_BOLEH = ["MASTER", "FINANCE"];

const unduhanPdf = (pdf, namaFile) =>
  new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${namaFile}"`,
      "Cache-Control": "private, no-store",
    },
  });

// GET /api/absensi-pegawai/pdf?bulan=YYYY-MM
//   • bulan sudah lewat & arsipnya ada  -> PDF arsip dari storage (tanpa menyusun ulang)
//   • bulan sudah lewat & belum ada      -> disusun sekarang, disimpan sebagai arsip
//     (foto satuan dihapus belakangan oleh /tutup-bulan)
//   • bulan berjalan                     -> PDF "sementara", tidak disimpan
export async function GET(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ROLE_BOLEH.includes(profile.role)) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const bulan = new URL(req.url).searchParams.get("bulan");
  if (!bulanValid(bulan)) return NextResponse.json({ error: "bulan harus berformat YYYY-MM." }, { status: 400 });

  const bulanIni = tanggalWIB().slice(0, 7);
  if (bulan > bulanIni) return NextResponse.json({ error: "Bulan itu belum berjalan." }, { status: 400 });

  const [tahun, bln] = bulan.split("-").map(Number);
  const namaFile = `Absensi Pegawai - ${NAMA_BULAN[bln - 1]} ${tahun}${bulan === bulanIni ? " (sementara)" : ""}.pdf`;
  const kosong = () => NextResponse.json({ error: "Belum ada absensi pada bulan itu." }, { status: 404 });

  try {
    if (bulan < bulanIni) {
      const arsip = await ambilArsip(supabaseAdmin, bulan);
      if (arsip) {
        const { data, error } = await supabaseAdmin.storage.from(BUCKET_ABSENSI).download(arsip.pdf_path);
        if (!error && data) return unduhanPdf(await data.arrayBuffer(), namaFile);
        // Berkas arsip hilang dari storage: jatuh ke penyusunan ulang di bawah.
      }
    }

    const logo = await fetch(new URL("/logo.png", req.url))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Uint8Array(b) : null))
      .catch(() => null);

    if (bulan < bulanIni) {
      const hasil = await simpanArsip(supabaseAdmin, bulan, { logo });
      return hasil ? unduhanPdf(hasil.pdf, namaFile) : kosong();
    }
    const hasil = await buatPdfBulan(supabaseAdmin, bulan, { logo, sementara: true });
    return hasil ? unduhanPdf(hasil.pdf, namaFile) : kosong();
  } catch (e) {
    console.error("absensi-pegawai/pdf gagal:", e?.message);
    return NextResponse.json({ error: "Gagal membuat PDF." }, { status: 500 });
  }
}
