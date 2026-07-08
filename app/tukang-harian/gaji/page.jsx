import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import BackButton from "@/components/BackButton";
import KalenderAbsensiMandor from "@/components/KalenderAbsensiMandor";

export const dynamic = "force-dynamic";

const UPAH_HARIAN = 180000; // Rp per hari kerja, tukang harian dibayar per hari hadir

export default async function DompetTukangHarianPage() {
  const { profile, supabase } = await getSessionProfile();

  const today = new Date();
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d) => d.toISOString().slice(0, 10);

  const { data: proyek } = profile.proyek_id
    ? await supabase
        .from("proyek")
        .select("id")
        .eq("id", profile.proyek_id)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  // Ambil checkin_harian tukang harian (absensi lokasi) bulan ini
  const chatId = String(profile.telegram_chat_id ?? profile.id ?? "");
  const { data: checkin } = await supabase
    .from("checkin_harian")
    .select("tanggal")
    .eq("chat_id", chatId)
    .gte("tanggal", iso(bulanIni));

  const hariHadir = (checkin || []).length;
  const gajiBulanIni = hariHadir * UPAH_HARIAN;
  const bulanLabel = today.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <main className="p-4 pb-8">
      <BackButton href={proyek ? `/tukang-harian?proyek=${proyek.id}` : "/tukang-harian"} />
      <h1 className="text-xl font-bold tracking-tight">Dompet Saya</h1>
      <p className="mb-4 text-sm text-gray-500">Upah harian & rekap kehadiran</p>

      <div className="hero mb-5">
        <p className="text-sm text-white/80">Gaji Bulan Ini · {bulanLabel}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{rupiah(gajiBulanIni)}</p>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15">
          <div>
            <p className="text-xs text-white/70">Hari hadir</p>
            <p className="font-bold">{hariHadir} hari</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">Upah per hari</p>
            <p className="font-bold">{rupiah(UPAH_HARIAN)}</p>
          </div>
        </div>
      </div>

      <h2 className="mt-2 mb-3 font-bold text-gray-700">Kalender Absensi</h2>
      <KalenderAbsensiMandor initialCheckin={checkin || []} gajiPokok={0} />
    </main>
  );
}
