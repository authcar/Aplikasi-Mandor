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
      "id, no, proyek_id, uraian, foto_url, foto_bukti_url, video_url, video_bukti_url, periode, status, catatan_tolak, created_at, selesai_at, proyek(nama), creator:created_by(name)"
    )
    .order("created_at", { ascending: false });

  const paths = [
    ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
    ...(rows || []).filter((r) => r.foto_bukti_url).map((r) => r.foto_bukti_url),
    ...(rows || []).filter((r) => r.video_url).map((r) => r.video_url),
    ...(rows || []).filter((r) => r.video_bukti_url).map((r) => r.video_bukti_url),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage.from("perbaikan").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const items = (rows || []).map((r) => ({
    id: r.id,
    no: r.no,
    proyek_id: r.proyek_id,
    uraian: r.uraian,
    periode: r.periode,
    status: r.status,
    catatan_tolak: r.catatan_tolak,
    created_at: r.created_at,
    selesai_at: r.selesai_at,
    proyek: r.proyek?.nama || "-",
    pembuat: r.creator?.name || "-",
    foto: r.foto_url ? urlMap[r.foto_url] || null : null,
    fotoBukti: r.foto_bukti_url ? urlMap[r.foto_bukti_url] || null : null,
    video: r.video_url ? urlMap[r.video_url] || null : null,
    videoBukti: r.video_bukti_url ? urlMap[r.video_bukti_url] || null : null,
  }));

  const menunggu = items.filter((i) => i.status === "PENDING_REVIEW").length;

  return (
    <main className="p-4 pb-10">
      <BackButton href="/master" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Defect List</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">
        {items.length} item · {menunggu} menunggu persetujuan Supervisor
      </p>
      <PerbaikanList items={items} />
    </main>
  );
}
