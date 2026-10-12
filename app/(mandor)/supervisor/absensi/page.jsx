import { getSessionProfile } from "@/lib/supabase/server";
import { groupAbsensiTimPerHari } from "@/lib/format";
import AbsensiTimForm from "./AbsensiTimForm";

export const dynamic = "force-dynamic";

export default async function AbsensiTukangPage() {
  const { supabase } = await getSessionProfile();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const mulaiRiwayat = new Date();
  mulaiRiwayat.setDate(mulaiRiwayat.getDate() - 30);
  const iso30HariLalu = mulaiRiwayat.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: rows }, { data: fotoRows }, { data: riwayatRows }, { data: proyekList }] = await Promise.all([
    supabase
      .from("absensi_tim")
      .select("tim, jumlah, kegiatan, urutan, proyek_id")
      .eq("tanggal", today)
      .order("urutan"),
    supabase
      .from("absensi_tim_foto")
      .select("id, foto_url")
      .eq("tanggal", today)
      .order("created_at"),
    supabase
      .from("absensi_tim")
      .select("tanggal, tim, jumlah, kegiatan, urutan")
      .gte("tanggal", iso30HariLalu)
      .lt("tanggal", today)
      .order("tanggal", { ascending: false })
      .order("urutan"),
    supabase.from("proyek").select("id, nama").eq("is_active", true).order("nama"),
  ]);

  const riwayat = groupAbsensiTimPerHari(riwayatRows);

  // Kelompokkan baris ke struktur per tim (urutan dipertahankan)
  const tims = [];
  for (const r of rows || []) {
    const last = tims[tims.length - 1];
    const line = { jumlah: r.jumlah != null ? String(r.jumlah) : "", kegiatan: r.kegiatan };
    if (last && last.nama === r.tim) last.lines.push(line);
    else tims.push({ nama: r.tim, proyekId: r.proyek_id || "", lines: [line] });
  }

  // Signed URL untuk dokumentasi yang sudah ter-upload
  let fotos = [];
  if (fotoRows?.length) {
    const { data: signed } = await supabase.storage
      .from("absensi")
      .createSignedUrls(fotoRows.map((f) => f.foto_url), 3600);
    const urlMap = Object.fromEntries(
      (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
    );
    fotos = fotoRows
      .map((f) => ({ id: f.id, path: f.foto_url, url: urlMap[f.foto_url] }))
      .filter((f) => f.url);
  }

  return (
    <AbsensiTimForm
      initialTims={tims}
      initialFotos={fotos}
      today={today}
      riwayat={riwayat}
      proyekList={proyekList || []}
    />
  );
}
