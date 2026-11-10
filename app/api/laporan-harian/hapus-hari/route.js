import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { bolehKoreksiLaporan } from "@/lib/laporanKoreksi";
import { klienLaporan, supabaseAdmin } from "@/lib/laporanAkses";
import { daftarFoto } from "@/lib/laporanFoto";

export const dynamic = "force-dynamic";

const ROLE_BOLEH = ["MASTER", "SUPERVISOR", "HEAD_OF_PRODUCTION"];

// POST /api/laporan-harian/hapus-hari — JSON { proyek_id, tanggal: "YYYY-MM-DD" }
// Menghapus SEMUA kegiatan satu proyek pada satu hari — tetapi hanya yang
// memang boleh dikoreksi pemakainya (aturan sama dengan hapus satuan:
// lib/laporanKoreksi.js). Sisanya dilewati, bukan ditolak.
export async function POST(req) {
  const { profile, supabase: supabaseUser } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ROLE_BOLEH.includes(profile.role)) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  const supabase = klienLaporan(profile, supabaseUser);

  const { proyek_id, tanggal } = await req.json().catch(() => ({}));
  if (!proyek_id || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal || ""))
    return NextResponse.json({ error: "proyek_id dan tanggal wajib diisi." }, { status: 400 });

  const { data: rows, error } = await supabase
    .from("laporan_harian")
    .select("id, proyek_id, created_by, created_at, foto_url, foto_urls")
    .eq("proyek_id", proyek_id)
    .eq("tanggal", tanggal);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const boleh = (rows || []).filter((laporan) => bolehKoreksiLaporan({ peran: profile.role, userId: profile.id, laporan }));
  if (!boleh.length)
    return NextResponse.json({ error: "Tidak ada kegiatan yang boleh Anda hapus." }, { status: 403 });

  const { data: terhapus, error: delErr } = await supabase
    .from("laporan_harian")
    .delete()
    .in("id", boleh.map((r) => r.id))
    .select("id");
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // File hanya dibuang untuk baris yang benar-benar terhapus (RLS bisa menolak sebagian).
  const idTerhapus = new Set((terhapus || []).map((r) => r.id));
  const paths = boleh.filter((r) => idTerhapus.has(r.id)).flatMap(daftarFoto);
  if (paths.length) await supabaseAdmin.storage.from("progres").remove(paths).catch(() => {});

  return NextResponse.json({
    ok: true,
    ids: [...idTerhapus],
    dilewati: (rows?.length || 0) - idTerhapus.size,
  });
}
