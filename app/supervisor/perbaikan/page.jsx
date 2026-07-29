import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanForm from "./PerbaikanForm";

export const dynamic = "force-dynamic";

// Checklist Perbaikan (defect list) — Supervisor melaporkan temuan perbaikan
// per proyek; Mandor proyek tsb mendapat notifikasi & menandai selesai.
export default async function PerbaikanSupervisorPage() {
  const { supabase } = await getSessionProfile();

  const [{ data: proyek }, { data: rows }, { data: mandors }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama, mandor:mandor_id(name)")
      .eq("is_active", true)
      .order("nama"),
    // CANCELLED disembunyikan dari daftar aktif Supervisor (dibatalkan lewat
    // ikon X di card) — tetap tersimpan & muncul di riwayat Master.
    supabase
      .from("checklist_perbaikan")
      .select(
        "id, proyek_id, no, uraian, foto_url, foto_bukti_url, periode, status, dibaca_supervisor, assigned_mandor_id, created_at, proyek(nama), assigned:assigned_mandor_id(name)"
      )
      .neq("status", "CANCELLED")
      .order("proyek_id", { ascending: true })
      .order("no", { ascending: true }),
    // Daftar Mandor buat dropdown "Tugaskan ke Mandor" — fallback kalau
    // proyek.mandor_id kosong/salah (lihat add_checklist_assigned_mandor.sql).
    supabase.from("profiles").select("id, name").eq("role", "MANDOR").order("name"),
  ]);

  const items = [];
  for (const r of rows || []) {
    let foto = null;
    if (r.foto_url) {
      const { data } = await supabase.storage
        .from("perbaikan")
        .createSignedUrl(r.foto_url, 3600);
      foto = data?.signedUrl || null;
    }
    let fotoBukti = null;
    if (r.foto_bukti_url) {
      const { data } = await supabase.storage
        .from("perbaikan")
        .createSignedUrl(r.foto_bukti_url, 3600);
      fotoBukti = data?.signedUrl || null;
    }
    items.push({
      id: r.id,
      proyek_id: r.proyek_id,
      no: r.no,
      uraian: r.uraian,
      periode: r.periode,
      status: r.status,
      dibaca_supervisor: r.dibaca_supervisor,
      created_at: r.created_at,
      proyek: r.proyek?.nama || "-",
      assignedMandorId: r.assigned_mandor_id,
      assignedMandorName: r.assigned?.name || null,
      foto,
      fotoBukti,
    });
  }

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
      <PerbaikanForm proyeks={proyek || []} items={items} mandors={mandors || []} />
    </main>
  );
}
