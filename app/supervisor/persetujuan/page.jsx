import { getSessionProfile } from "@/lib/supabase/server";
import ApprovalList from "./ApprovalList";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

// ============ B. HALAMAN PERSETUJUAN SUPERVISOR ============
export default async function PersetujuanPage() {
  const { supabase } = await getSessionProfile();

  // Lembur + Keuangan berstatus PENDING (RLS membatasi ke proyek supervisor ini)
  const [{ data: lembur }, { data: keuangan }] = await Promise.all([
    supabase
      .from("lembur")
      .select(
        "id, jam, total, catatan, created_at, proyek(nama), tukang(nama), creator:created_by(name)"
      )
      .eq("status", "PENDING")
      .order("created_at", { ascending: true }),
    supabase
      .from("keuangan")
      .select(
        "id, jenis, nominal, keterangan, nota_url, created_at, proyek(nama), tukang(nama), creator:created_by(name)"
      )
      .eq("status", "PENDING")
      .order("created_at", { ascending: true }),
  ]);

  // Buat signed URL untuk nota (bucket private)
  const items = [];
  for (const l of lembur || []) {
    items.push({
      id: l.id,
      _tipe: "lembur",
      _label: "LEMBUR",
      _judul: `${l.tukang?.nama} · ${l.jam} jam`,
      _proyek: l.proyek?.nama,
      _mandor: l.creator?.name,
      _nominal: l.total,
      _nota: null,
    });
  }
  for (const k of keuangan || []) {
    let nota = null;
    if (k.nota_url) {
      const { data } = await supabase.storage
        .from("nota")
        .createSignedUrl(k.nota_url, 3600);
      nota = data?.signedUrl || null;
    }
    items.push({
      id: k.id,
      _tipe: "keuangan",
      _label: k.jenis,
      _judul: k.keterangan || (k.tukang?.nama ?? "Pengeluaran"),
      _proyek: k.proyek?.nama,
      _mandor: k.creator?.name,
      _nominal: k.nominal,
      _nota: nota,
    });
  }

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Persetujuan</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">
        {items.length} pengajuan menunggu
      </p>
      <ApprovalList items={items} />
    </main>
  );
}
