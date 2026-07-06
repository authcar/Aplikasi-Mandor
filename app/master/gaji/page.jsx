import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DompetMasterPage() {
  const { profile, supabase } = await getSessionProfile();

  // Master melihat semua proyek aktif (tidak difilter supervisor_id)
  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, icon, nilai_proyek, mandor:mandor_id(name)")
    .eq("is_active", true)
    .order("nama");

  const totalNilai = (proyek || []).reduce((sum, p) => sum + (p.nilai_proyek || 0), 0);
  const proyekDenganNilai = (proyek || []).filter((p) => p.nilai_proyek);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Nilai Proyek</h1>
      <p className="mb-4 text-sm text-gray-500">{proyek?.length || 0} proyek aktif</p>

      {/* Total Budget Card */}
      <div className="hero shrink-0 flex items-center gap-3 py-4 px-4 mb-5 rounded-2xl">
        <span className="icon-tile bg-white/15 text-white">
          <Icon name="wallet" />
        </span>
        <div className="flex-1">
          <p className="text-xs text-white/80">Total Budget Semua Proyek</p>
          <p className="text-2xl font-bold leading-tight">
            {totalNilai > 0 ? rupiah(totalNilai) : "—"}
          </p>
          <p className="text-xs text-white/70 mt-0.5">
            {proyekDenganNilai.length} dari {proyek?.length || 0} proyek memiliki nilai
          </p>
        </div>
      </div>

      {/* Per-Project Budget List */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-bold text-gray-700 text-sm">Nilai Per Proyek</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(proyek || []).map((p) => (
            <Link key={p.id} href={`/master/proyek/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
              <span className="icon-tile bg-brand-50 text-brand-600 !w-9 !h-9 shrink-0">
                <Icon name={p.icon || "building"} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.nama}</p>
                <p className="text-xs text-gray-500 truncate">{p.lokasi || "—"} · {p.mandor?.name || "Belum ada mandor"}</p>
              </div>
              <div className="text-right shrink-0">
                {p.nilai_proyek ? (
                  <p className="text-sm font-bold text-emerald-600">{rupiah(p.nilai_proyek)}</p>
                ) : (
                  <p className="text-sm text-gray-300">—</p>
                )}
              </div>
            </Link>
          ))}
          {(proyek || []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              Belum ada proyek aktif.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
