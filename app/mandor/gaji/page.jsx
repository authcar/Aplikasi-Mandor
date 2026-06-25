import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

// Rincian Gaji: rekap biaya harian & mingguan untuk dilaporkan ke Owner.
export default async function GajiPage() {
  const { profile, supabase } = await getSessionProfile();
  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Senin minggu ini

  const sum = (rows, f) => (rows || []).reduce((s, r) => s + Number(f(r)), 0);

  // Upah dari absensi minggu ini
  const { data: abs } = await supabase
    .from("absensi")
    .select("tanggal, upah_snap, hadir")
    .eq("proyek_id", proyek?.id)
    .gte("tanggal", iso(monday));
  // Lembur & keuangan APPROVED minggu ini
  const { data: lbr } = await supabase
    .from("lembur")
    .select("tanggal, total")
    .eq("proyek_id", proyek?.id)
    .eq("status", "APPROVED")
    .gte("tanggal", iso(monday));
  const { data: keu } = await supabase
    .from("keuangan")
    .select("created_at, nominal, jenis")
    .eq("proyek_id", proyek?.id)
    .eq("status", "APPROVED")
    .gte("created_at", iso(monday));

  const upahHariIni = sum(abs?.filter((a) => a.tanggal === iso(today)), (a) => a.upah_snap);
  const upahMinggu = sum(abs, (a) => a.upah_snap);
  const lemburMinggu = sum(lbr, (l) => l.total);
  const keuMinggu = sum(keu, (k) => k.nominal);
  const totalMinggu = upahMinggu + lemburMinggu + keuMinggu;

  return (
    <main className="p-4 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Rekap Gaji</h1>
        <Link href="/mandor" className="text-sm text-gray-500">
          ‹ Kembali
        </Link>
      </header>
      <p className="mb-4 text-sm text-gray-500">{proyek?.nama}</p>

      <div className="mb-4 rounded-2xl bg-brand p-5 text-white">
        <p className="text-sm opacity-90">Total Biaya Minggu Ini</p>
        <p className="text-3xl font-bold">{rupiah(totalMinggu)}</p>
      </div>

      <div className="space-y-2">
        <Row label="Upah hari ini" val={upahHariIni} />
        <Row label="Upah tukang (minggu)" val={upahMinggu} />
        <Row label="Lembur disetujui (minggu)" val={lemburMinggu} />
        <Row label="Kasbon + Reimburse (minggu)" val={keuMinggu} />
      </div>

      <p className="mt-4 text-xs text-gray-400">
        *Hanya lembur, kasbon & reimburse berstatus DISETUJUI yang dihitung.
      </p>
    </main>
  );
}

function Row({ label, val }) {
  return (
    <div className="flex items-center justify-between rounded-xl border-2 border-gray-200 bg-white p-4">
      <span className="text-gray-600">{label}</span>
      <span className="font-bold">{rupiah(val)}</span>
    </div>
  );
}
