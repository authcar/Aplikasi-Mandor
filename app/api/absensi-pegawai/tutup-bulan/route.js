import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { hapusFotoBulan, simpanArsip } from "@/lib/absensiPegawaiArsip";
import { tanggalWIB } from "@/lib/absensiPegawaiAturan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/absensi-pegawai/tutup-bulan — dipanggil n8n, cukup sekali sehari
// (mis. 01:00 WIB); aman dipanggil berulang.
//
// Untuk setiap bulan kalender yang SUDAH LEWAT dan masih punya foto satuan:
//   1. susun PDF arsipnya dan simpan,
//   2. kalau semua foto tercatat ikut masuk PDF, baru hapus foto satuannya.
// Foto tidak pernah dihapus sebelum arsipnya lengkap dan tersimpan. Satu bulan
// diproses per panggilan supaya muat di batas waktu; sisanya menyusul di
// panggilan berikutnya.
//
// Autentikasi: header x-n8n-secret, pola sama dengan
// app/api/kunjungan/tutup-otomatis/route.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const awalBulanIni = `${tanggalWIB().slice(0, 7)}-01`;
  const { data: sisa, error } = await supabaseAdmin
    .from("absensi_pegawai")
    .select("tanggal")
    .lt("tanggal", awalBulanIni)
    .or("foto_masuk_path.not.is.null,foto_keluar_path.not.is.null")
    .order("tanggal")
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sisa?.length) return NextResponse.json({ ok: true, diproses: null });

  const bulan = sisa[0].tanggal.slice(0, 7);
  try {
    // Selalu disusun ulang (bukan memakai arsip yang mungkin sudah dibuat dari
    // tombol unduh): hanya hasil yang baru saja diverifikasi lengkap yang boleh
    // jadi dasar menghapus foto.
    const logo = await fetch(new URL("/logo.png", req.url))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Uint8Array(b) : null))
      .catch(() => null);
    const hasil = await simpanArsip(supabaseAdmin, bulan, { logo });
    if (!hasil || hasil.jumlahFoto < hasil.diharapkan)
      return NextResponse.json(
        { error: `Arsip ${bulan} belum lengkap (${hasil?.jumlahFoto ?? 0}/${hasil?.diharapkan ?? 0} foto); foto tidak dihapus.` },
        { status: 500 }
      );
    const dihapus = await hapusFotoBulan(supabaseAdmin, bulan);
    return NextResponse.json({ ok: true, diproses: bulan, foto_dihapus: dihapus });
  } catch (e) {
    console.error("absensi-pegawai/tutup-bulan gagal:", e?.message);
    return NextResponse.json({ error: e?.message || "Gagal menutup bulan." }, { status: 500 });
  }
}
