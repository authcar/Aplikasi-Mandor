import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import MasalahList from "./MasalahList";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

// Daftar laporan masalah dari mandor (RLS membatasi ke proyek supervisor ini).
export default async function MasalahSupervisorPage() {
  const { supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("masalah")
    .select(
      "id, judul, material, jumlah, satuan, urgensi, deskripsi, status, created_at, proyek(nama), creator:created_by(name)"
    )
    .order("created_at", { ascending: false });

  // Signed URL untuk foto (bucket 'masalah' private)
  const items = [];
  for (const m of rows || []) {
    let foto = null;
    if (m.foto_url) {
      const { data } = await supabase.storage
        .from("masalah")
        .createSignedUrl(m.foto_url, 3600);
      foto = data?.signedUrl || null;
    }
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
      foto,
    });
  }

  const aktif = items.filter((i) => i.status !== "DONE").length;

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <header className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Kurang Material</h1>
        <Link
          href="/supervisor/masalah/baru"
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white active:bg-brand-800"
        >
          + Lapor
        </Link>
      </header>
      <p className="mb-4 text-sm text-gray-500">{aktif} masalah belum selesai</p>
      <MasalahList items={items} />
    </main>
  );
}
