import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import KelolaAkunTabs from "./KelolaAkunTabs";

export const dynamic = "force-dynamic";

// Gabungan /master/mandor + /master/tukang-harian — satu halaman "Kelola
// Akun" dengan tab, isinya pakai manager component yang sudah ada.
export default async function KelolaAkunFinancePage() {
  const { supabase } = await getSessionProfile();

  const [{ data: mandorRows }, { data: proyekList }] = await Promise.all([
    supabase.from("profiles").select("id, name, phone, email").eq("role", "MANDOR").order("name"),
    supabase.from("proyek").select("id, nama").eq("is_active", true).order("nama"),
  ]);

  const mandors = (mandorRows || []).map((r) => ({ id: r.id, name: r.name, phone: r.phone, email: r.email }));

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
      <BackButton href="/finance" />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Kelola Akun</h1>
        <p className="text-sm text-gray-500">Kelola akun login mandor & tukang harian</p>
      </header>

      <KelolaAkunTabs mandors={mandors} proyekList={proyekList || []} workers={workers || []} />
    </main>
  );
}
