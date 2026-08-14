import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

const tglPendek = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

// Read-only bagi Master — input biaya/penerimaan tetap eksklusif role
// FINANCE, lihat app/finance/proyek/[id]/biaya.
export default async function BiayaProyekMasterPage({ params }) {
  const { supabase } = await getSessionProfile();
  const { id } = params;

  const [{ data: proyek }, { data: biaya }, { data: penerimaan }] = await Promise.all([
    supabase.from("proyek").select("id, nama, icon").eq("id", id).single(),
    supabase
      .from("biaya_proyek")
      .select("id, nominal, keterangan, tanggal, pos:pos_id(nama)")
      .eq("proyek_id", id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("penerimaan_proyek")
      .select("id, nominal, keterangan, tanggal")
      .eq("proyek_id", id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  const daftarBiaya = biaya || [];
  const daftarPenerimaan = penerimaan || [];
  const totalBiaya = daftarBiaya.reduce((s, b) => s + Number(b.nominal || 0), 0);
  const totalPenerimaan = daftarPenerimaan.reduce((s, p) => s + Number(p.nominal || 0), 0);
  const profitLoss = totalPenerimaan - totalBiaya;

  const rekapPos = [...daftarBiaya
    .reduce((map, b) => {
      const nama = b.pos?.nama || "Tanpa Pos";
      map.set(nama, (map.get(nama) || 0) + Number(b.nominal || 0));
      return map;
    }, new Map())
    .entries()]
    .sort((a, b) => b[1] - a[1]);

  return (
    <main className="p-4 pb-8">
      <BackButton href={`/master/proyek/${id}`} />
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Biaya & Profit Proyek</h1>
        <p className="text-sm text-gray-500">{proyek.nama}</p>
      </header>

      <div className="card mb-4 p-4 space-y-3">
        <div className="flex divide-x divide-gray-100">
          <div className="flex-1">
            <p className="text-[11px] text-gray-400">Total Penerimaan</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(totalPenerimaan)}</p>
          </div>
          <div className="flex-1 pl-3">
            <p className="text-[11px] text-gray-400">Total Biaya</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(totalBiaya)}</p>
          </div>
        </div>
        <div className={`rounded-xl p-3 ${profitLoss >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className={`text-[11px] ${profitLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {profitLoss >= 0 ? "Profit" : "Loss"}
          </p>
          <p className={`text-lg font-bold ${profitLoss >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {rupiah(Math.abs(profitLoss))}
          </p>
        </div>
      </div>

      {rekapPos.length > 0 && (
        <div className="card mb-4 divide-y divide-gray-100">
          <div className="px-4 py-2.5">
            <p className="font-bold text-gray-700 text-sm">Biaya per Pos</p>
          </div>
          {rekapPos.map(([nama, total]) => (
            <div key={nama} className="flex items-center justify-between px-4 py-2.5">
              <p className="text-sm text-gray-600">{nama}</p>
              <p className="text-sm font-semibold text-gray-800">{rupiah(total)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-4 divide-y divide-gray-100">
        <div className="px-4 py-2.5">
          <p className="font-bold text-gray-700 text-sm">Riwayat Biaya</p>
        </div>
        {daftarBiaya.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada biaya tercatat.</div>
        )}
        {daftarBiaya.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{b.pos?.nama || "Tanpa Pos"}</p>
                <span className="shrink-0 text-xs text-gray-400">{tglPendek(b.tanggal)}</span>
              </div>
              {b.keterangan && <p className="truncate text-xs text-gray-500">{b.keterangan}</p>}
            </div>
            <p className="shrink-0 text-sm font-bold text-gray-800">{rupiah(b.nominal)}</p>
          </div>
        ))}
      </div>

      <div className="card divide-y divide-gray-100">
        <div className="px-4 py-2.5">
          <p className="font-bold text-gray-700 text-sm">Riwayat Penerimaan</p>
        </div>
        {daftarPenerimaan.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada penerimaan tercatat.</div>
        )}
        {daftarPenerimaan.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{p.keterangan || "Penerimaan"}</p>
                <span className="shrink-0 text-xs text-gray-400">{tglPendek(p.tanggal)}</span>
              </div>
            </div>
            <p className="shrink-0 text-sm font-bold text-gray-800">{rupiah(p.nominal)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
