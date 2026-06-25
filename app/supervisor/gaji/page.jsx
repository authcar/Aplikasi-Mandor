import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import BackButton from "@/components/BackButton";
import GajiList from "@/components/GajiList";

export const dynamic = "force-dynamic";

// Rekap gaji gabungan: semua proyek supervisor, biaya minggu ini.
export default async function GajiSupervisorPage() {
  const { profile, supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi")
    .eq("supervisor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Senin minggu ini
  const sum = (rows, f) => (rows || []).reduce((s, r) => s + Number(f(r)), 0);

  // Hitung rekap tiap proyek secara paralel.
  const rekap = await Promise.all(
    (proyek || []).map(async (p) => {
      const [{ data: abs }, { data: lbr }, { data: keu }] = await Promise.all([
        supabase
          .from("absensi")
          .select("upah_snap")
          .eq("proyek_id", p.id)
          .gte("tanggal", iso(monday)),
        supabase
          .from("lembur")
          .select("total")
          .eq("proyek_id", p.id)
          .eq("status", "APPROVED")
          .gte("tanggal", iso(monday)),
        supabase
          .from("keuangan")
          .select("nominal, jenis")
          .eq("proyek_id", p.id)
          .eq("status", "APPROVED")
          .gte("created_at", iso(monday)),
      ]);

      const upah = sum(abs, (a) => a.upah_snap);
      const lembur = sum(lbr, (l) => l.total);
      const reimburse = sum(
        (keu || []).filter((k) => k.jenis === "REIMBURSE"),
        (k) => k.nominal
      );
      const kasbon = sum(
        (keu || []).filter((k) => k.jenis === "KASBON"),
        (k) => k.nominal
      );
      return { ...p, upah, lembur, reimburse, kasbon, total: upah + lembur + reimburse + kasbon };
    })
  );

  const totalSemua = rekap.reduce((s, r) => s + r.total, 0);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <h1 className="mb-1 text-xl font-bold">Rekap Gaji</h1>
      <p className="mb-4 text-sm text-gray-500">Biaya minggu ini · semua proyek</p>

      <div className="mb-5 rounded-2xl bg-brand p-5 text-white">
        <p className="text-sm opacity-90">Total Biaya Semua Proyek</p>
        <p className="text-3xl font-bold">{rupiah(totalSemua)}</p>
      </div>

      <GajiList rekap={rekap} />

      <p className="mt-4 text-xs text-gray-400">
        *Ketuk proyek untuk lihat rincian. Hanya lembur, kasbon & reimburse berstatus
        DISETUJUI yang dihitung.
      </p>
    </main>
  );
}
