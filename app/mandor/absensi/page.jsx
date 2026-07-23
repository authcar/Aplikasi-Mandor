import { getSessionProfile } from "@/lib/supabase/server";
import DaftarHadirCard from "./DaftarHadirCard";

export const dynamic = "force-dynamic";

// Absensi mandor sekarang read-only: daftar orang yang hadir hari ini
// diambil dari laporan absensi_tim milik Supervisor (bukan input mandor
// sendiri lagi — fitur roll-call lama sudah dihapus).
export default async function AbsensiPage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  let q = supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  q = searchParams?.proyek ? q.eq("id", searchParams.proyek) : q.order("nama").limit(1);
  const { data: proyek } = await q.maybeSingle();

  let tims = [];
  let totalOrang = 0;

  if (proyek) {
    // absensi_tim_foto TIDAK punya proyek_id (company-wide, lihat catatan di
    // schema.sql), jadi tidak bisa disaring per proyek — sengaja tidak
    // ditampilkan di sini biar gak ketuker dokumentasi proyek lain.
    const { data: rows } = await supabase
      .from("absensi_tim")
      .select("tim, jumlah, kegiatan, urutan")
      .eq("proyek_id", proyek.id)
      .eq("tanggal", today)
      .order("urutan");

    // Kelompokkan baris ke struktur per tim (urutan dipertahankan), sama
    // seperti di AbsensiTimForm milik Supervisor.
    for (const r of rows || []) {
      const last = tims[tims.length - 1];
      const line = { jumlah: r.jumlah, kegiatan: r.kegiatan };
      if (last && last.nama === r.tim) last.lines.push(line);
      else tims.push({ nama: r.tim, lines: [line] });
    }

    totalOrang = (rows || []).reduce((s, r) => s + (r.jumlah > 0 ? r.jumlah : 1), 0);
  }

  return <DaftarHadirCard proyek={proyek} tims={tims} totalOrang={totalOrang} />;
}
