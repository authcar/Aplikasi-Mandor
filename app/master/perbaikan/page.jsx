import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanList from "./PerbaikanList";

export const dynamic = "force-dynamic";

// Riwayat Checklist Perbaikan (read-only) — Master memantau semua proyek,
// termasuk bukti pengerjaan Mandor & hasil review Supervisor. Approval
// tetap wewenang Supervisor, lihat app/supervisor/perbaikan.
export default async function PerbaikanMasterPage() {
  const { supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("checklist_perbaikan")
    .select(
      "id, no, uraian, foto_url, foto_bukti_url, periode, status, created_at, selesai_at, proyek(nama), creator:created_by(name)"
    )
    .order("created_at", { ascending: false });

  const items = [];
  for (const r of rows || []) {
    let foto = null;
    if (r.foto_url) {
      const { data } = await supabase.storage.from("perbaikan").createSignedUrl(r.foto_url, 3600);
      foto = data?.signedUrl || null;
    }
    let fotoBukti = null;
    if (r.foto_bukti_url) {
      const { data } = await supabase.storage.from("perbaikan").createSignedUrl(r.foto_bukti_url, 3600);
      fotoBukti = data?.signedUrl || null;
    }
    items.push({
      id: r.id,
      no: r.no,
      uraian: r.uraian,
      periode: r.periode,
      status: r.status,
      created_at: r.created_at,
      selesai_at: r.selesai_at,
      proyek: r.proyek?.nama || "-",
      pembuat: r.creator?.name || "-",
      foto,
      fotoBukti,
    });
  }

  const menunggu = items.filter((i) => i.status === "PENDING_REVIEW").length;

  return (
    <main className="p-4 pb-10">
      <BackButton href="/master" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Checklist Perbaikan</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">
        {items.length} item · {menunggu} menunggu persetujuan Supervisor
      </p>
      <PerbaikanList items={items} />
    </main>
  );
}
