import Link from "next/link";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

// Ringkasan 1 lembar: tiap proyek on-going -> total penerimaan, total
// biaya, profit/loss. Tap satu proyek untuk lihat rincian per pos & input
// biaya/penerimaan barunya di app/finance/proyek/[id]/biaya.
export default async function BiayaProyekFinancePage() {
  const { supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, icon")
    .eq("is_active", true)
    .order("nama");

  const proyekIds = (proyek || []).map((p) => p.id);

  const [{ data: biaya }, { data: penerimaan }] = await Promise.all([
    proyekIds.length
      ? supabase.from("biaya_proyek").select("proyek_id, nominal").in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
    proyekIds.length
      ? supabase.from("penerimaan_proyek").select("proyek_id, nominal").in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
  ]);

  const biayaByProyek = new Map();
  for (const b of biaya || []) biayaByProyek.set(b.proyek_id, (biayaByProyek.get(b.proyek_id) || 0) + Number(b.nominal || 0));
  const penerimaanByProyek = new Map();
  for (const p of penerimaan || []) penerimaanByProyek.set(p.proyek_id, (penerimaanByProyek.get(p.proyek_id) || 0) + Number(p.nominal || 0));

  const list = (proyek || []).map((p) => {
    const totalBiaya = biayaByProyek.get(p.id) || 0;
    const totalPenerimaan = penerimaanByProyek.get(p.id) || 0;
    return { ...p, totalBiaya, totalPenerimaan, profitLoss: totalPenerimaan - totalBiaya };
  });

  const grandBiaya = list.reduce((s, p) => s + p.totalBiaya, 0);
  const grandPenerimaan = list.reduce((s, p) => s + p.totalPenerimaan, 0);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/finance" />
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Biaya Proyek</h1>
        <p className="text-sm text-gray-500">Ringkasan penerimaan, biaya & profit tiap proyek</p>
      </header>

      <div className="card mb-4 flex items-center gap-3 p-3.5">
        <span className="icon-tile bg-emerald-50 text-emerald-600 !h-10 !w-10 !text-lg">
          <Icon name="wallet" className="h-5 w-5" />
        </span>
        <div className="flex flex-1 divide-x divide-gray-100">
          <div className="flex-1 pl-1">
            <p className="text-[11px] text-gray-400">Total Penerimaan</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(grandPenerimaan)}</p>
          </div>
          <div className="flex-1 pl-3">
            <p className="text-[11px] text-gray-400">Total Biaya</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(grandBiaya)}</p>
          </div>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {list.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada proyek dari Taraco.</div>
        )}
        {list.map((p) => (
          <Link
            key={p.id}
            href={`/finance/proyek/${p.id}/biaya`}
            className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
          >
            <span className="icon-tile bg-brand-50 text-brand-600 !w-8 !h-8">
              <Icon name={p.icon || "building"} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.nama}</p>
              <p className="truncate text-xs text-gray-500">
                Penerimaan {rupiah(p.totalPenerimaan)} · Biaya {rupiah(p.totalBiaya)}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-bold ${p.profitLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {p.profitLoss >= 0 ? "Profit" : "Loss"}
            </span>
            <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </main>
  );
}
