import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import BackButton from "@/components/BackButton";
import GajiList from "@/components/GajiList";

export const dynamic = "force-dynamic";

// Rincian Gaji proyek mandor — tampilan sama seperti rekap supervisor.
export default async function GajiPage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();

  let pq = supabase
    .from("proyek")
    .select("id, nama, lokasi")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  pq = searchParams?.proyek ? pq.eq("id", searchParams.proyek) : pq.order("nama").limit(1);
  const { data: proyek } = await pq.maybeSingle();

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Senin minggu ini
  const sum = (rows, f) => (rows || []).reduce((s, r) => s + Number(f(r)), 0);

  let rekap = [];
  let total = 0;
  if (proyek) {
    const [{ data: abs }, { data: lbr }, { data: keu }] = await Promise.all([
      supabase
        .from("absensi")
        .select("upah_snap")
        .eq("proyek_id", proyek.id)
        .gte("tanggal", iso(monday)),
      supabase
        .from("lembur")
        .select("total")
        .eq("proyek_id", proyek.id)
        .eq("status", "APPROVED")
        .gte("tanggal", iso(monday)),
      supabase
        .from("keuangan")
        .select("nominal, jenis")
        .eq("proyek_id", proyek.id)
        .eq("status", "APPROVED")
        .gte("created_at", iso(monday)),
    ]);

    const upah = sum(abs, (a) => a.upah_snap);
    const lembur = sum(lbr, (l) => l.total);
    const reimburse = sum((keu || []).filter((k) => k.jenis === "REIMBURSE"), (k) => k.nominal);
    const kasbon = sum((keu || []).filter((k) => k.jenis === "KASBON"), (k) => k.nominal);
    total = upah + lembur + reimburse + kasbon;
    rekap = [
      { id: proyek.id, nama: proyek.nama, lokasi: proyek.lokasi, upah, lembur, reimburse, kasbon, total },
    ];
  }

  return (
    <main className="p-4 pb-8">
      <BackButton href={proyek ? `/mandor?proyek=${proyek.id}` : "/mandor"} />
      <h1 className="mb-1 text-xl font-bold">Rekap Gaji</h1>
      <p className="mb-4 text-sm text-gray-500">Biaya minggu ini</p>

      <div className="mb-5 rounded-2xl bg-brand p-5 text-white">
        <p className="text-sm opacity-90">Total Biaya Minggu Ini</p>
        <p className="text-3xl font-bold">{rupiah(total)}</p>
      </div>

      <GajiList rekap={rekap} />

      <p className="mt-4 text-xs text-gray-400">
        *Ketuk proyek untuk lihat rincian. Hanya lembur, kasbon & reimburse berstatus
        DISETUJUI yang dihitung.
      </p>
    </main>
  );
}
