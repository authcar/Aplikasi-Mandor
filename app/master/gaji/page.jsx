import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PotonganCard from "@/components/PotonganCard";
import CalendarPotongan from "@/components/CalendarPotongan";
import GajiSupervisorHero from "@/components/GajiSupervisorHero";

export const dynamic = "force-dynamic";

export default async function GajiMasterPage() {
  const { profile, supabase } = await getSessionProfile();

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1);

  const chatId = String(profile.telegram_chat_id ?? "");

  const [{ data: potongan }, { data: checkin }] = await Promise.all([
    supabase
      .from("potongan_gaji")
      .select("id, tanggal, persentase")
      .eq("chat_id", chatId)
      .gte("tanggal", iso(bulanIni))
      .order("tanggal"),
    supabase
      .from("checkin_harian")
      .select("tanggal")
      .eq("chat_id", chatId)
      .gte("tanggal", iso(bulanIni)),
  ]);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Rekap Gaji</h1>
      <p className="mb-4 text-sm text-gray-500">Gaji bulan ini</p>

      <GajiSupervisorHero
        gajiPokok={profile.gaji_pokok || 0}
        potongan={potongan || []}
      />

      <h2 className="mt-6 mb-3 font-bold text-gray-700">Kalender Laporan Harian</h2>
      <CalendarPotongan
        chatId={profile.telegram_chat_id}
        initialPotongan={potongan || []}
        initialCheckin={checkin || []}
      />

      <h2 className="mt-5 mb-3 font-bold text-gray-700">Performa {profile.name}</h2>
      <PotonganCard rows={potongan || []} gajiPokok={profile.gaji_pokok || 0} />
    </main>
  );
}
