// Loader server untuk area staf portal. Penyaringan proyek per staf dilakukan
// di sini (tabel portal_* tidak punya policy RLS, lihat lib/portal/db.js).
import { db, hasil, UUID } from "./db";

export async function ambilProyekStaf(staf) {
  let q = db().from("portal_proyek").select("*").order("aktif", { ascending: false }).order("created_at", { ascending: false });
  if (staf.role !== "ADMIN") q = q.eq("supervisor_id", staf.id);
  return hasil(q);
}

export async function ambilProyek(id) {
  if (!UUID.test(id || "")) return null;
  return hasil(db().from("portal_proyek").select("*").eq("id", id).maybeSingle());
}

export async function ambilSupervisor() {
  const rows = await hasil(db().from("profiles").select("id, name").eq("role", "SUPERVISOR").order("name"));
  return rows.map((s) => ({ id: s.id, nama: s.name }));
}

export async function ambilTermin(proyekId) {
  return hasil(
    db().from("portal_termin").select("id, urutan, label, persen, jatuh_tempo, lunas_tgl").eq("proyek_id", proyekId).order("urutan")
  );
}

// Link rahasia klien; `id` = token.
export async function ambilKlien(proyekId) {
  const rows = await hasil(
    db().from("portal_link").select("token, nama, created_at").eq("proyek_id", proyekId).order("created_at")
  );
  return rows.map(({ token, ...r }) => ({ id: token, ...r }));
}

// Bobot tahap hasil pengaturan admin: { [jenis]: { [tahap]: persen } }.
// Jenis yang belum pernah diubah tidak ada di sini (pakai bawaan progresBoq.js).
export async function ambilBobotTahap() {
  let rows;
  try {
    rows = await hasil(db().from("portal_bobot_tahap").select("jenis, tahap, bobot"));
  } catch (e) {
    // Tabelnya belum dibuat (supabase/add_portal_bobot_tahap.sql) -> semua bawaan.
    if (/could not find the table|does not exist/i.test(e.message)) return {};
    throw e;
  }
  const out = {};
  for (const r of rows) (out[r.jenis] ||= {})[r.tahap] = Number(r.bobot);
  return out;
}

// Item BOQ + progres: [{ ...portal_item, progres: { [tahap]: "YYYY-MM-DD" } }]
// bobot_tahap ikut ditempel supaya hitungan di lib/portal/progresBoq.js
// memakai pengaturan admin, di server maupun di browser.
export async function ambilItem(proyekIds) {
  if (!proyekIds.length) return [];
  const bobot = await ambilBobotTahap();
  const rows = await hasil(
    db().from("portal_item")
      .select("id, proyek_id, area, kode, nama, jenis, qty, satuan, dimensi, harga, bobot, urutan, portal_progres(tahap, selesai_tgl)")
      .in("proyek_id", proyekIds)
      .order("urutan")
      .order("created_at")
  );
  return rows.map(({ portal_progres, ...i }) => ({
    ...i,
    bobot_tahap: bobot[i.jenis] || null,
    progres: Object.fromEntries(portal_progres.map((g) => [g.tahap, g.selesai_tgl])),
  }));
}
