import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah } from "@/lib/format";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import NilaiJasaList from "./NilaiJasaList";

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
      <h1 className="text-xl font-bold tracking-tight">Nilai Jasa Tukang</h1>
      <p className="mb-4 text-sm text-gray-500">{proyek?.length || 0} proyek aktif</p>

      {/* Total Budget Card */}
      <div className="hero shrink-0 flex items-center gap-3 py-4 px-4 mb-5 rounded-2xl">
        <span className="icon-tile bg-white/15 text-white">
          <Icon name="wallet" />
        </span>
        <div className="flex-1">
          <p className="text-xs text-white/80">Total Nilai Jasa Semua Proyek</p>
          <p className="text-2xl font-bold leading-tight">
            {totalNilai > 0 ? rupiah(totalNilai) : "—"}
          </p>
          <p className="text-xs text-white/70 mt-0.5">
            {proyekDenganNilai.length} dari {proyek?.length || 0} proyek memiliki nilai
          </p>
        </div>
      </div>

      {/* Per-Project Budget List */}
      <NilaiJasaList proyek={proyek || []} />
    </main>
  );
}
