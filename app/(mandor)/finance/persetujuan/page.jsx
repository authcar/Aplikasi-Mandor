import { getSessionProfile } from "@/lib/supabase/server";
import ApprovalList from "./ApprovalList";

export const dynamic = "force-dynamic";

export default async function PersetujuanFinancePage() {
  const { supabase } = await getSessionProfile();

  const [{ data: lembur }, { data: keuangan }] = await Promise.all([
    supabase
      .from("lembur")
      .select("id, jam, total, catatan, tanggal, foto_url, status, created_at, proyek(nama), creator:created_by(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("keuangan")
      .select("id, jenis, nominal, keterangan, nota_url, status, catatan_tolak, created_at, dibaca_master, proyek(nama), creator:created_by(name)")
      .order("created_at", { ascending: false }),
  ]);

  // Tandai kasbon baru sudah dilihat Finance supaya badge di dashboard hilang.
  const kasbonBelumDibaca = (keuangan || [])
    .filter((k) => k.jenis === "KASBON" && !k.dibaca_master)
    .map((k) => k.id);
  if (kasbonBelumDibaca.length > 0) {
    await supabase.from("keuangan").update({ dibaca_master: true }).in("id", kasbonBelumDibaca);
  }

  const items = [];

  for (const l of lembur || []) {
    let foto = null;
    if (l.foto_url) {
      const { data } = await supabase.storage.from("lembur").createSignedUrl(l.foto_url, 3600);
      foto = data?.signedUrl || null;
    }
    items.push({
      id: l.id,
      _tipe: "lembur",
      _label: "LEMBUR",
      _judul: l.catatan || "Lembur",
      _proyek: l.proyek?.nama,
      _mandor: l.creator?.name,
      _nominal: l.total,
      _jam: l.jam,
      _tanggal: l.tanggal || l.created_at?.slice(0, 10),
      _status: l.status,
      _nota: foto,
    });
  }

  for (const k of keuangan || []) {
    let nota = null;
    if (k.nota_url) {
      const { data } = await supabase.storage.from("nota").createSignedUrl(k.nota_url, 3600);
      nota = data?.signedUrl || null;
    }
    items.push({
      id: k.id,
      _tipe: "keuangan",
      _label: k.jenis,
      _judul: k.keterangan || "Pengeluaran",
      _proyek: k.proyek?.nama,
      _mandor: k.creator?.name,
      _nominal: k.nominal,
      _jam: null,
      _tanggal: k.created_at?.slice(0, 10),
      _status: k.status,
      _catatanTolak: k.catatan_tolak,
      _nota: nota,
    });
  }

  items.sort((a, b) => b._tanggal?.localeCompare(a._tanggal));

  return (
    <main className="p-4 pb-8">
      <h1 className="text-xl font-bold tracking-tight mb-1">Laporan</h1>
      <p className="mb-4 text-sm text-gray-500">
        {items.filter((i) => i._status === "PENDING").length} pengajuan menunggu
      </p>
      <ApprovalList items={items} />
    </main>
  );
}
