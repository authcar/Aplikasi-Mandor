import { getSessionProfile } from "@/lib/supabase/server";
import MasalahList from "./MasalahList";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function MasalahMasterPage() {
  const { supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("masalah")
    .select(
      "id, judul, material, jumlah, satuan, urgensi, deskripsi, status, created_at, proyek(nama), creator:created_by(name)"
    )
    .order("created_at", { ascending: false });

  const items = [];
  for (const m of rows || []) {
    items.push({
      id: m.id,
      judul: m.judul,
      material: m.material || m.judul,
      jumlah: m.jumlah,
      satuan: m.satuan,
      urgensi: m.urgensi,
      catatan: m.deskripsi,
      status: m.status,
      created_at: m.created_at,
      proyek: m.proyek?.nama || "-",
      mandor: m.creator?.name || "-",
    });
  }

  const aktif = items.filter((i) => i.status !== "DONE").length;

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Kurang Material</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">{aktif} masalah belum selesai</p>
      <MasalahList items={items} />
    </main>
  );
}
