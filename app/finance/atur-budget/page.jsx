import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import BudgetRow from "./BudgetRow";

export const dynamic = "force-dynamic";

// Finance mengatur Nilai Jasa Tukang & Sisa Budget semua proyek aktif dari
// satu daftar ringkas, tanpa perlu buka detail proyek satu-satu. Field ini
// manual (tidak disinkron dari Taraco) — lihat app/api/proyek/route.js.
export default async function AturBudgetPage() {
  const { supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, icon, nilai_proyek, sisa_budget")
    .eq("is_active", true)
    .order("nama");

  const list = proyek || [];
  const totalNilai = list.reduce((s, p) => s + Number(p.nilai_proyek || 0), 0);
  const totalSisa = list.reduce((s, p) => s + Number(p.sisa_budget || 0), 0);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/finance" />
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Atur Budget</h1>
        <p className="text-sm text-gray-500">Nilai jasa tukang & sisa budget per proyek</p>
      </header>

      <div className="card mb-4 flex items-center gap-3 p-3.5">
        <span className="icon-tile bg-emerald-50 text-emerald-600 !h-10 !w-10 !text-lg">
          <Icon name="wallet" className="h-5 w-5" />
        </span>
        <div className="flex flex-1 divide-x divide-gray-100">
          <div className="flex-1 pl-1">
            <p className="text-[11px] text-gray-400">Total Nilai Jasa</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(totalNilai)}</p>
          </div>
          <div className="flex-1 pl-3">
            <p className="text-[11px] text-gray-400">Total Sisa Budget</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(totalSisa)}</p>
          </div>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {list.map((p) => (
          <BudgetRow key={p.id} proyek={p} />
        ))}
        {list.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada proyek dari Taraco.</div>
        )}
      </div>
    </main>
  );
}
