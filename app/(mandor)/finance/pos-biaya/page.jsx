import BackButton from "@/components/BackButton";
import { getSessionProfile } from "@/lib/supabase/server";
import PosBiayaManager from "./PosBiayaManager";

export const dynamic = "force-dynamic";

// Finance mengelola daftar Pos Biaya (kategori pengeluaran proyek — Beli
// Bahan, Jasa Tukang, Transport, dll) dari sini. Dipakai saat input biaya
// di app/finance/proyek/[id]/biaya.
export default async function PosBiayaPage() {
  const { supabase } = await getSessionProfile();

  const { data: pos } = await supabase
    .from("pos_biaya")
    .select("id, nama, is_active")
    .order("nama");

  return (
    <main className="p-4 pb-8">
      <BackButton href="/finance" />
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight">Pos Biaya</h1>
        <p className="text-sm text-gray-500">Kategori pengeluaran proyek (beli bahan, jasa tukang, transport, dll)</p>
      </header>

      <PosBiayaManager initialPos={pos || []} />
    </main>
  );
}
