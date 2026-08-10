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
// Setiap proyek Taraco punya 2 pipeline independen: MASTER (status
// keseluruhan proyek: design_wip/catatan/prod_ongoing/done) dan PRODUCTION
// (papan kanban tugas produksi harian: new/production/done). Proyek ditarik
// masuk hanya kalau MASTER-nya prod_ongoing DAN kanban PRODUCTION-nya BELUM
// "done" — kartu PRODUCTION bisa pindah ke "Done" duluan sementara MASTER
// masih prod_ongoing, itu tandanya kerja lapangan Mandor/Supervisor selesai.
// Proyek yang sudah kadung masuk lalu keluar dari kriteria ini (pindah
// stage, ditandai done, atau dihapus) di Taraco otomatis dinonaktifkan
// (is_active = false) di blok deaktivasi di bawah — supaya tidak terus
// muncul ke Master/Mandor/Supervisor.
export async function syncProyekFromTaraco() {
  const taraco = createTaracoClient();

  const [
    { data: taracoProjects, error: taracoError },
    { data: doneProduction, error: doneError },
    { data: profiles },
  ] = await Promise.all([
    taraco
      .from("projects")
      .select("id, name, location, budget, due_date, mandors, supervisor, project_pipelines!inner(stage, active, pipeline)")
      .eq("project_pipelines.pipeline", "MASTER")
      .eq("project_pipelines.active", true)
      .eq("project_pipelines.stage", "prod_ongoing"),
    taraco.from("project_pipelines").select("project_id").eq("pipeline", "PRODUCTION").eq("stage", "done"),
    supabaseAdmin.from("profiles").select("id, name, role").in("role", ["MANDOR", "SUPERVISOR"]),
  ]);

  // Gagal ambil data Taraco (error jaringan/query) — jangan sentuh data
  // lokal sama sekali, baik upsert maupun deaktivasi di bawah.
  if (taracoError || doneError) return;

  const doneProductionIds = new Set((doneProduction || []).map((r) => r.project_id));
  const projects = (taracoProjects || []).filter((p) => !doneProductionIds.has(p.id));

  // p.mandors: jsonb array nama (1 proyek bisa dipegang >1 mandor, lihat
  // supabase/add_proyek_mandor.sql). Dicocokkan ke akun MANDOR by name,
  // urutan dipertahankan sesuai array Taraco.
  const cocokkanMandorIds = (namaArr) => {
    const ids = [];
    for (const nama of Array.isArray(namaArr) ? namaArr : []) {
      const cocok = (profiles || []).find((pr) => pr.role === "MANDOR" && namaCocok(pr.name, nama));
      if (cocok && !ids.includes(cocok.id)) ids.push(cocok.id);
    }
    return ids;
  };

  if (projects.length) {
    // nilai_proyek TIDAK disinkron dari Taraco (budget) — sejak field ini bisa
    // diinput manual oleh Master di Aplikasi Mandor (app/api/proyek/route.js),
    // upsert di sini tidak boleh menimpanya, jadi kolom tsb sengaja tidak
    // disebut di rows berikut.
    const mandorIdsByTaraco = new Map();
    const rows = projects.map((p) => {
      const mandorIds = cocokkanMandorIds(p.mandors);
      mandorIdsByTaraco.set(p.id, mandorIds);
      return {
        taraco_id: p.id,
        nama: p.name,
        lokasi: p.location || null,
        deadline: p.due_date || null,
        // mandor_id = mandor pertama di array, dipertahankan buat kode lama
        // yang masih pakai kolom tunggal ini (lihat komentar di atas fungsi).
        mandor_id: mandorIds[0] || null,
        supervisor_id: (profiles || []).find((pr) => pr.role === "SUPERVISOR" && namaCocok(pr.name, p.supervisor))?.id || null,
        is_active: true,
      };
    });

    const { data: upserted } = await supabaseAdmin
      .from("proyek")
      .upsert(rows, { onConflict: "taraco_id" })
      .select("id, taraco_id");

    await sinkronkanProyekMandor(upserted || [], mandorIdsByTaraco);
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

// Rekonsiliasi proyek_mandor (daftar lengkap mandor per proyek) supaya
// selalu mencerminkan projects.mandors terbaru dari Taraco — hapus pasangan
// yang sudah tidak ada di array, tambahkan yang baru. Cuma menyentuh baris
// yang benar-benar berubah (bukan hapus-lalu-insert-semua) supaya sinkron
// yang dipanggil di tiap load dashboard tidak boros write.
async function sinkronkanProyekMandor(upserted, mandorIdsByTaraco) {
  const idByTaraco = Object.fromEntries(upserted.map((r) => [r.taraco_id, r.id]));
  const proyekIds = Object.values(idByTaraco);
  if (!proyekIds.length) return;

  const diinginkan = [];
  for (const [taracoId, mandorIds] of mandorIdsByTaraco) {
    const proyekId = idByTaraco[taracoId];
    if (!proyekId) continue;
    for (const mandorId of mandorIds) diinginkan.push({ proyek_id: proyekId, mandor_id: mandorId });
  }

  const { data: sekarang } = await supabaseAdmin
    .from("proyek_mandor")
    .select("proyek_id, mandor_id")
    .in("proyek_id", proyekIds);

  const kunci = (r) => `${r.proyek_id}:${r.mandor_id}`;
  const setSekarang = new Set((sekarang || []).map(kunci));
  const setDiinginkan = new Set(diinginkan.map(kunci));

  const tambah = diinginkan.filter((r) => !setSekarang.has(kunci(r)));
  const hapus = (sekarang || []).filter((r) => !setDiinginkan.has(kunci(r)));

  if (tambah.length) await supabaseAdmin.from("proyek_mandor").insert(tambah);
  if (hapus.length) {
    await Promise.all(
      hapus.map((r) =>
        supabaseAdmin.from("proyek_mandor").delete().eq("proyek_id", r.proyek_id).eq("mandor_id", r.mandor_id)
      )
    );
  }
}
