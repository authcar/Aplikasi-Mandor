import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createTaracoClient } from "@/lib/supabase/taraco";
import { STAGE_HOP } from "@/lib/supabase/syncProyek";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Proyek yang dipegang Head of Production: semua proyek Taraco yang pipeline
// MASTER-nya di "kickoff" (Kick Off Meeting) atau "prod_ongoing" (Production),
// dan kanban PRODUCTION-nya belum "done". Tidak bergantung pada nama
// supervisor/mandor.
//
// Dibaca langsung dari Taraco (bukan dari proyek.is_active) karena proyek yang
// masih kickoff sengaja tidak aktif di tempat lain. Barisnya sendiri di tabel
// `proyek` dibuat oleh syncProyekFromTaraco, jadi panggil itu lebih dulu.
//
// Mengembalikan Map<id proyek lokal, "kickoff" | "prod_ongoing">. Gagal
// membaca Taraco -> jatuh ke proyek yang aktif saja, supaya halamannya tidak kosong.
export async function proyekHop() {
  const hasil = new Map();
  try {
    const taraco = createTaracoClient();
    const [{ data: master, error: errMaster }, { data: selesai, error: errSelesai }] = await Promise.all([
      taraco
        .from("project_pipelines")
        .select("project_id, stage")
        .eq("pipeline", "MASTER")
        .eq("active", true)
        .in("stage", STAGE_HOP),
      taraco.from("project_pipelines").select("project_id").eq("pipeline", "PRODUCTION").eq("stage", "done"),
    ]);
    if (errMaster || errSelesai) throw new Error((errMaster || errSelesai).message);

    const done = new Set((selesai || []).map((r) => r.project_id));
    const stagePerTaraco = new Map((master || []).filter((r) => !done.has(r.project_id)).map((r) => [r.project_id, r.stage]));
    if (!stagePerTaraco.size) return hasil;

    const { data: lokal } = await supabaseAdmin
      .from("proyek")
      .select("id, taraco_id")
      .in("taraco_id", [...stagePerTaraco.keys()]);
    for (const p of lokal || []) hasil.set(p.id, stagePerTaraco.get(p.taraco_id));
    return hasil;
  } catch (e) {
    console.error("proyekHop gagal, memakai proyek aktif:", e?.message);
    const { data } = await supabaseAdmin.from("proyek").select("id").eq("is_active", true);
    for (const p of data || []) hasil.set(p.id, "prod_ongoing");
    return hasil;
  }
}

export const STAGE_LABEL = { kickoff: "Kick Off Meeting", prod_ongoing: "Production" };
