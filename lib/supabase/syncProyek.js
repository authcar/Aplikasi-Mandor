import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createTaracoClient } from "@/lib/supabase/taraco";

// Admin client lokal (service role, bypass RLS) — sama pola dengan app/api/mandor/route.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const namaCocok = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// Sinkronkan tabel `proyek` lokal dari project Taraco (satu-satunya sumber
// identitas proyek). Idempoten — aman dipanggil di setiap load dashboard.
// mandor_id/supervisor_id dicocokkan otomatis dari kolom teks Taraco ke
// nama akun profil role MANDOR/SUPERVISOR.
//
// Hanya proyek yang sedang di stage "Production" (project_pipelines: pipeline
// MASTER, active, stage prod_ongoing) yang ditarik masuk. Proyek yang sudah
// kadung masuk lalu pindah stage (atau dihapus) di Taraco otomatis
// dinonaktifkan (is_active = false) di blok deaktivasi di bawah — supaya
// tidak terus muncul ke Master/Mandor/Supervisor.
export async function syncProyekFromTaraco() {
  const taraco = createTaracoClient();

  const [{ data: taracoProjects, error: taracoError }, { data: profiles }] = await Promise.all([
    taraco
      .from("projects")
      .select("id, name, location, budget, mandor, supervisor, project_pipelines!inner(stage, active, pipeline)")
      .eq("project_pipelines.pipeline", "MASTER")
      .eq("project_pipelines.active", true)
      .eq("project_pipelines.stage", "prod_ongoing"),
    supabaseAdmin.from("profiles").select("id, name, role").in("role", ["MANDOR", "SUPERVISOR"]),
  ]);

  // Gagal ambil data Taraco (error jaringan/query) — jangan sentuh data
  // lokal sama sekali, baik upsert maupun deaktivasi di bawah.
  if (taracoError) return;

  const projects = taracoProjects || [];

  if (projects.length) {
    // nilai_proyek TIDAK disinkron dari Taraco (budget) — sejak field ini bisa
    // diinput manual oleh Master di Aplikasi Mandor (app/api/proyek/route.js),
    // upsert di sini tidak boleh menimpanya, jadi kolom tsb sengaja tidak
    // disebut di rows berikut.
    const rows = projects.map((p) => ({
      taraco_id: p.id,
      nama: p.name,
      lokasi: p.location || null,
      mandor_id: (profiles || []).find((pr) => pr.role === "MANDOR" && namaCocok(pr.name, p.mandor))?.id || null,
      supervisor_id: (profiles || []).find((pr) => pr.role === "SUPERVISOR" && namaCocok(pr.name, p.supervisor))?.id || null,
      is_active: true,
    }));

    await supabaseAdmin.from("proyek").upsert(rows, { onConflict: "taraco_id" });
  }

  // Proyek lokal yang sebelumnya tersinkron (taraco_id terisi) tapi sekarang
  // tidak lagi ada di daftar aktif Taraco — dihapus atau pindah keluar dari
  // stage prod_ongoing — dinonaktifkan di sini (bukan dihapus, histori
  // absensi/lembur/keuangan tetap ada).
  let deactivateQuery = supabaseAdmin
    .from("proyek")
    .update({ is_active: false })
    .eq("is_active", true)
    .not("taraco_id", "is", null);

  const activeIds = projects.map((p) => p.id);
  if (activeIds.length) {
    deactivateQuery = deactivateQuery.not("taraco_id", "in", `(${activeIds.join(",")})`);
  }

  await deactivateQuery;
}
