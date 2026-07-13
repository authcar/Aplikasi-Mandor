import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import TukangHarianManager from "@/components/TukangHarianManager";

export const dynamic = "force-dynamic";

export default async function TukangHarianMasterPage() {
  const { supabase } = await getSessionProfile();

  // Master melihat semua proyek aktif (tidak difilter supervisor_id)
  const { data: proyekList } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("is_active", true)
    .order("nama");

  const proyekIds = (proyekList || []).map((p) => p.id);

  const { data: workers } = proyekIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, phone, proyek_id, pin")
        .eq("role", "TUKANG_HARIAN")
        .in("proyek_id", proyekIds)
        .order("name")
    : { data: [] };

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Tukang Harian</h1>
        <p className="text-sm text-gray-500">Kelola akun login tukang harian di semua proyek</p>
      </header>

      {proyekList?.length ? (
        <TukangHarianManager proyekList={proyekList} initialWorkers={workers || []} />
      ) : (
        <div className="card p-6 text-center text-sm text-gray-400">
          Belum ada proyek aktif.
        </div>
      )}
    </main>
  );
}
