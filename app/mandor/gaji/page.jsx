import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import KalenderAbsensiMandor from "@/components/KalenderAbsensiMandor";
import GajiSupervisorHero from "@/components/GajiSupervisorHero";

export const dynamic = "force-dynamic";

const POTONGAN_PER_HARI = 0.5;

function hariKerja(year, month, sampaiTanggal) {
  const hasil = [];
  const batas = new Date(sampaiTanggal);
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const tgl = new Date(year, month, d);
    if (tgl > batas) break;
    if (tgl.getDay() !== 0) {
      hasil.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }
  return hasil;
}

export default async function DompetMandorPage({ searchParams }) {
  const { user, profile, supabase } = await getSessionProfile();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d) => d.toISOString().slice(0, 10);

  let pq = supabase
    .from("proyek")
    .select("id")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  pq = searchParams?.proyek ? pq.eq("id", searchParams.proyek) : pq.order("nama").limit(1);
  const { data: proyek } = await pq.maybeSingle();

  // Ambil checkin_harian mandor (absensi lokasi)
  const { data: checkin } = await supabase
    .from("checkin_harian")
    .select("tanggal")
    .eq("chat_id", user.id)
    .gte("tanggal", iso(bulanIni));

  // Hitung potongan dari hari absen (format sama dengan PotonganCard)
  const hadirSet = new Set((checkin || []).map((r) => r.tanggal));
  const kerja = hariKerja(today.getFullYear(), today.getMonth(), todayStr);
  const absenDates = kerja.filter((d) => !hadirSet.has(d));
  const potonganRows = absenDates.map((tgl, i) => ({
    id: i,
    tanggal: tgl,
    persentase: POTONGAN_PER_HARI,
  }));

  return (
    <main className="p-4 pb-8">
      <BackButton href={proyek ? `/mandor?proyek=${proyek.id}` : "/mandor"} />
      <h1 className="text-xl font-bold tracking-tight">Dompet Saya</h1>
      <p className="mb-4 text-sm text-gray-500">Gaji bulanan & potongan absensi</p>

      <GajiSupervisorHero
        gajiPokok={profile.gaji_pokok || 0}
        potongan={potonganRows}
        label="Gaji Mandor"
      />

      <h2 className="mt-2 mb-3 font-bold text-gray-700">Kalender Absensi</h2>
      <KalenderAbsensiMandor
        initialCheckin={checkin || []}
        gajiPokok={profile.gaji_pokok || 0}
      />
    </main>
  );
}
