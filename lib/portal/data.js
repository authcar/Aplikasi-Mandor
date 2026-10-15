// Loader server untuk area staf portal. Penyaringan proyek per staf dilakukan
// di sini (tabel portal_* tidak punya policy RLS, lihat lib/portal/db.js).
import { db, hasil, UUID } from "./db";
import { beriBerat } from "./progresBoq";

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

// select("*") supaya tetap jalan sebelum kolom `dibayar` dan `jenis` ada
// (supabase/add_portal_pembayaran.sql, add_portal_termin_jenis.sql).
export async function ambilTermin(proyekId) {
  const rows = await hasil(db().from("portal_termin").select("*").eq("proyek_id", proyekId).order("urutan"));
  return rows.map((t) => ({
    id: t.id, urutan: t.urutan, jenis: t.jenis || "produksi", label: t.label, persen: t.persen,
    jatuh_tempo: t.jatuh_tempo, lunas_tgl: t.lunas_tgl, dibayar: t.dibayar ?? null,
  }));
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
// `proyek` = baris portal_proyek. bobot_tahap (khusus item kalau ada, selain
// itu bobot jenisnya) dan berat (penimbang pilihan proyeknya) ikut ditempel
// supaya hitungan di lib/portal/progresBoq.js memakai pengaturan admin, di
// server maupun di browser. select("*") supaya tetap jalan sebelum kolom
// bobot_tahap ada (supabase/add_portal_bobot_item.sql).
export async function ambilItem(proyek) {
  if (!proyek.length) return [];
  const proyekIds = proyek.map((p) => p.id);
  const bobot = await ambilBobotTahap();
  const rows = await hasil(
    db().from("portal_item")
      .select("*, portal_progres(tahap, selesai_tgl)")
      .in("proyek_id", proyekIds)
      .order("urutan")
      .order("created_at")
  );
  const items = rows.map(({ portal_progres, ...i }) => ({
    ...i,
    bobot_tahap: i.bobot_tahap || bobot[i.jenis] || null,
    bobot_khusus: !!i.bobot_tahap,
    progres: Object.fromEntries(portal_progres.map((g) => [g.tahap, g.selesai_tgl])),
  }));
  return proyek.flatMap((p) => beriBerat(items.filter((i) => i.proyek_id === p.id), p.timbang_harga));
}
