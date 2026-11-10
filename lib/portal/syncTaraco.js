// Project Tracker <- Taraco Project Management. Server-only.
// Begitu proyek Taraco (pipeline MASTER) masuk stage "DP / SPK", ia otomatis
// dibuatkan proyek di Project Tracker (portal_proyek). Proyek yang sudah ada tidak
// diubah lagi, jadi tidak masalah ia berpindah stage sesudahnya.
//
// - Idempoten lewat portal_proyek.taraco_id (unik).
// - Proyek portal manual dengan nama yang sama (belum punya taraco_id) DITAUTKAN,
//   bukan diduplikasi.
// - Proyek yang dihapus admin dicatat di portal_taraco_lewat dan tidak dibuat ulang.
// - Gagal apa pun (jaringan ke Taraco, kolom belum dimigrasi) diam saja: beranda
//   portal tetap tampil, sinkron dicoba lagi di load berikutnya.
// Migrasi: supabase/add_portal_taraco.sql.
import { createTaracoClient } from "@/lib/supabase/taraco";
import { db } from "./db";

// Proyek ditarik kalau sekarang di STAGE_MASUK, atau sudah pernah masuk DP / SPK
// sejak MULAI_SINKRON dan sekarang di STAGE_LANJUT (log Taraco: "MASTER: -> dp_spk").
// Yang kedua menangkap proyek yang sempat berpindah stage sebelum portal dibuka;
// MULAI_SINKRON mencegah proyek lama yang sudah berjalan ikut tertarik semua.
export const STAGE_MASUK = "dp_spk";
export const STAGE_LANJUT = ["kickoff", "prod_ongoing"];
export const MULAI_SINKRON = "2026-11-10";

const normal = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Dipanggil di tiap load beranda portal, tapi 3 query ke Taraco itu berat:
// paling sering sekali per interval per instance server, dan panggilan yang
// datang saat sinkron berjalan ikut menunggu hasil yang sama.
const INTERVAL_MS = 60_000;
let terakhir = 0;
let berjalan = null;

export function syncPortalDariTaraco({ paksa = false } = {}) {
  if (berjalan) return berjalan;
  if (!paksa && Date.now() - terakhir < INTERVAL_MS) return Promise.resolve();
  berjalan = jalankan()
    .then((ok) => {
      if (ok) terakhir = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      berjalan = null;
    });
  return berjalan;
}

export async function jalankan() {
  const taraco = createTaracoClient();
  const [tpSemua, log, portal, lewat, profil] = await Promise.all([
    taraco
      .from("projects")
      .select("id, name, code, client, location, start_date, due_date, supervisor, project_pipelines!inner(stage, active, pipeline)")
      .eq("project_pipelines.pipeline", "MASTER")
      .eq("project_pipelines.active", true)
      .in("project_pipelines.stage", [STAGE_MASUK, ...STAGE_LANJUT]),
    taraco.from("activity_log").select("project_id").eq("text", `MASTER: -> ${STAGE_MASUK}`).gte("created_at", MULAI_SINKRON),
    db().from("portal_proyek").select("id, nama, taraco_id, supervisor_id"),
    db().from("portal_taraco_lewat").select("taraco_id"),
    db().from("profiles").select("id, name").eq("role", "SUPERVISOR"),
  ]);
  // Data apa pun tak terbaca (termasuk kolom taraco_id belum dibuat) -> jangan menulis.
  if (tpSemua.error || log.error || portal.error || lewat.error || profil.error) return false;

  const pernahMasuk = new Set(log.data.map((r) => r.project_id));
  const stageDari = (p) => (Array.isArray(p.project_pipelines) ? p.project_pipelines[0] : p.project_pipelines)?.stage;
  const tp = { data: tpSemua.data.filter((p) => stageDari(p) === STAGE_MASUK || pernahMasuk.has(p.id)) };

  const dilewati = new Set(lewat.data.map((r) => r.taraco_id));
  const sudahTertaut = new Map(portal.data.filter((r) => r.taraco_id).map((r) => [r.taraco_id, r]));
  // Proyek manual belum bertaut, dicari berdasarkan nama.
  const manual = portal.data.filter((r) => !r.taraco_id);
  const supervisorId = (nama) => profil.data.find((s) => normal(s.name) === normal(nama) && normal(nama))?.id || null;

  const baru = [];
  for (const p of tp.data) {
    if (dilewati.has(p.id)) continue;
    const sv = supervisorId(p.supervisor);

    const ada = sudahTertaut.get(p.id);
    if (ada) {
      // Hanya mengisi yang kosong; tidak menimpa hasil edit admin.
      if (!ada.supervisor_id && sv) await db().from("portal_proyek").update({ supervisor_id: sv }).eq("id", ada.id);
      continue;
    }

    const i = manual.findIndex((r) => normal(r.nama) === normal(p.name));
    if (i >= 0) {
      const [m] = manual.splice(i, 1);
      await db()
        .from("portal_proyek")
        .update({ taraco_id: p.id, ...(!m.supervisor_id && sv ? { supervisor_id: sv } : {}) })
        .eq("id", m.id);
      continue;
    }

    baru.push({
      taraco_id: p.id,
      nama: p.name,
      kode: p.code || null,
      klien_nama: p.client || null,
      lokasi: p.location || null,
      deadline: p.due_date || null,
      supervisor_id: sv,
      aktif: true,
      // `mulai` dibiarkan memakai default (hari ini) kalau Taraco belum punya tanggal mulai.
      ...(p.start_date ? { mulai: p.start_date } : {}),
    });
  }

  if (baru.length) {
    // ignoreDuplicates: dua instance yang berjalan bersamaan tidak saling bentrok.
    const { error } = await db().from("portal_proyek").upsert(baru, { onConflict: "taraco_id", ignoreDuplicates: true });
    if (error) return false;
  }
  return true;
}
