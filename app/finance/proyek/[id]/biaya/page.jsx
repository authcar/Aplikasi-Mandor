import BackButton from "@/components/BackButton";
import { getSessionProfile } from "@/lib/supabase/server";
import BiayaProyekManager from "./BiayaProyekManager";

export const dynamic = "force-dynamic";

// Ringkasan biaya (per pos) & penerimaan klien satu proyek, plus profit/loss
// (total penerimaan - total biaya) — lihat supabase/add_biaya_proyek.sql.
export default async function BiayaProyekPage({ params }) {
  const { supabase } = await getSessionProfile();
  const { id } = params;

  const [{ data: proyek }, { data: pos }, { data: biaya }, { data: penerimaan }] = await Promise.all([
    supabase.from("proyek").select("id, nama, icon").eq("id", id).single(),
    supabase.from("pos_biaya").select("id, nama, is_active").order("nama"),
    supabase
      .from("biaya_proyek")
      .select("id, pos_id, nominal, keterangan, tanggal, created_at, pos:pos_id(nama)")
      .eq("proyek_id", id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("penerimaan_proyek")
      .select("id, nominal, keterangan, tanggal, created_at")
      .eq("proyek_id", id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  return (
    <main className="p-4 pb-8">
      <BackButton href={`/finance/proyek/${id}`} />
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Biaya & Profit Proyek</h1>
        <p className="text-sm text-gray-500">{proyek.nama}</p>
      </header>

      <BiayaProyekManager
        proyekId={id}
        posList={(pos || []).filter((p) => p.is_active)}
        initialBiaya={biaya || []}
        initialPenerimaan={penerimaan || []}
      />
    </main>
  );
}
