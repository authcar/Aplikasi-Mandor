import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Read-only bagi Master — pengelolaan (tambah/nonaktifkan) pos biaya tetap
// eksklusif role FINANCE, lihat app/finance/pos-biaya.
export default async function PosBiayaMasterPage() {
  const { supabase } = await getSessionProfile();

  const { data: pos } = await supabase
    .from("pos_biaya")
    .select("id, nama, is_active")
    .order("nama");

  const list = pos || [];

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Pos Biaya</h1>
        <p className="text-sm text-gray-500">Kategori pengeluaran proyek (dikelola Finance)</p>
      </header>

      <div className="card divide-y divide-gray-100">
        {list.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada pos biaya.</div>
        )}
        {list.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`icon-tile !h-9 !w-9 ${p.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
              <Icon name="receipt" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${p.is_active ? "" : "text-gray-400 line-through"}`}>{p.nama}</p>
              {!p.is_active && <p className="text-xs text-gray-400">Nonaktif</p>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
