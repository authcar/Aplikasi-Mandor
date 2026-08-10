import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanForm from "./PerbaikanForm";
import { gabungkanMediaPerbaikan } from "@/lib/perbaikanMedia";

export const dynamic = "force-dynamic";

// Checklist Perbaikan (defect list) — Supervisor melaporkan temuan perbaikan
// per proyek; Mandor proyek tsb mendapat notifikasi & menandai selesai.
export default async function PerbaikanSupervisorPage() {
  const { supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, mandor:mandor_id(name)")
    .eq("is_active", true)
    .order("nama");

  const proyekIds = (proyek || []).map((p) => p.id);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: rows }, { data: laporanHariIni }, { data: proyekMandorRows }] = await Promise.all([
    // CANCELLED disembunyikan dari daftar aktif Supervisor (dibatalkan lewat
    // ikon X di card) — tetap tersimpan & muncul di riwayat Master.
    supabase
      .from("checklist_perbaikan")
      .select(
        "id, proyek_id, no, uraian, foto_url, foto_bukti_url, video_url, video_bukti_url, periode, status, dibaca_supervisor, assigned_mandor_id, assignedMandor:assigned_mandor_id(name), created_at, proyek(nama)"
      )
      .neq("status", "CANCELLED")
      .order("proyek_id", { ascending: true })
      .order("no", { ascending: true }),
    // Proyek yang sudah dikirimi laporan harian hari ini — dipakai buat
    // indikator warna per proyek di Defect List (lihat PerbaikanForm).
    proyekIds.length
      ? supabase.from("laporan_harian").select("proyek_id").eq("tanggal", todayStr).in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
    // Daftar lengkap mandor per proyek (bisa >1, lihat
    // supabase/add_proyek_mandor.sql) — dipakai buat batasi pilihan "assign
    // ke mandor" per item di PerbaikanForm hanya ke mandor proyek tsb.
    proyekIds.length
      ? supabase.from("proyek_mandor").select("proyek_id, mandor:mandor_id(id, name)").in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
  ]);

  const mandorsByProyek = {};
  for (const r of proyekMandorRows || []) {
    if (!r.mandor) continue;
    (mandorsByProyek[r.proyek_id] ||= []).push(r.mandor);
  }
  const proyekDenganMandor = (proyek || []).map((p) => ({ ...p, mandors: mandorsByProyek[p.id] || [] }));

  const sudahLaporIds = [...new Set((laporanHariIni || []).map((r) => r.proyek_id))];

  const ids = (rows || []).map((r) => r.id);
  const { data: mediaRows } = ids.length
    ? await supabase.from("checklist_perbaikan_media").select("id, checklist_id, jenis, tipe, path, urutan").in("checklist_id", ids)
    : { data: [] };

  const legacyPaths = [
    ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
    ...(rows || []).filter((r) => r.foto_bukti_url).map((r) => r.foto_bukti_url),
    ...(rows || []).filter((r) => r.video_url).map((r) => r.video_url),
    ...(rows || []).filter((r) => r.video_bukti_url).map((r) => r.video_bukti_url),
  ];
  const mediaPaths = (mediaRows || []).map((m) => m.path);
  const paths = [...new Set([...legacyPaths, ...mediaPaths])];
  const { data: signed } = paths.length
    ? await supabase.storage.from("perbaikan").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const merged = gabungkanMediaPerbaikan(rows, mediaRows, urlMap);
  const items = (rows || []).map((r, i) => ({
    id: r.id,
    proyek_id: r.proyek_id,
    no: r.no,
    uraian: r.uraian,
    periode: r.periode,
    status: r.status,
    dibaca_supervisor: r.dibaca_supervisor,
    created_at: r.created_at,
    proyek: r.proyek?.nama || "-",
    assigned_mandor_id: r.assigned_mandor_id,
    assignedMandorName: r.assignedMandor?.name || null,
    ...merged[i],
    // Path mentah (bukan signed URL) — dipakai buat trigger sync ke Google
    // Drive pas Supervisor menyetujui bukti (lihat setujuiBukti), fallback
    // utk item LAMA yang belum punya baris di checklist_perbaikan_media.
    foto_bukti_url: r.foto_bukti_url,
    video_bukti_url: r.video_bukti_url,
  }));

  // Tandai bukti pengerjaan baru sudah dilihat supaya badge "Baru" hilang.
  const belumDibaca = items.filter((i) => !i.dibaca_supervisor).map((i) => i.id);
  if (belumDibaca.length > 0) {
    await supabase.from("checklist_perbaikan").update({ dibaca_supervisor: true }).in("id", belumDibaca);
  }

  const aktif = items.filter((i) => i.status !== "DONE").length;
  const menunggu = items.filter((i) => i.status === "PENDING_REVIEW").length;

  return (
    <main className="p-4 pb-10">
      <BackButton href="/supervisor" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Defect List</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">
        {aktif} item belum selesai
        {menunggu > 0 ? ` · ${menunggu} menunggu persetujuan Anda` : ""}
      </p>
      <PerbaikanForm proyeks={proyekDenganMandor} items={items} sudahLaporIds={sudahLaporIds} />
    </main>
  );
}
