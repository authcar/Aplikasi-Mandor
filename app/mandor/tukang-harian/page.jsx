import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import TukangHarianManager from "@/components/TukangHarianManager";

export const dynamic = "force-dynamic";

export default async function TukangHarianMandorPage() {
  const { profile, supabase } = await getSessionProfile();

  const { data: proyekList } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
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
      <BackButton href="/mandor" />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">
          Tambah Tukang Harian
        </h1>
        <p className="text-sm text-gray-500">
          Kelola akun login tukang harian di proyek kamu
        </p>
      </header>

      {proyekList?.length ? (
        <TukangHarianManager
          proyekList={proyekList}
          initialWorkers={workers || []}
        />
      ) : (
        <div className="card p-6 text-center text-sm text-gray-400">
          Belum ada proyek aktif. Hubungi Supervisor Anda.
        </div>
      )}
    </main>
  );
}
