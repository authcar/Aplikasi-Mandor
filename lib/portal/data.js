// Loader server untuk area staf portal. Penyaringan proyek per staf dilakukan
// di sini (tabel portal_* tidak punya policy RLS, lihat lib/portal/db.js).
import { cache } from "react";
import { db, hasil, UUID } from "./db";
import { beriBerat, sudahInstalasi } from "./progresBoq";
import { urlFotoItem } from "./fotoItem";

// Item milik tim pekerja yang login: kolom "Tim pekerja" sama dengan nama akunnya
// (tanpa beda huruf besar/kecil dan spasi di ujung).
export const timSaya = (staf, item) =>
  !!staf?.nama && !!item.tim && item.tim.trim().toLowerCase() === staf.nama.trim().toLowerCase();

// Admin dan supervisor melihat semua proyek; tukang hanya proyek yang punya item timnya.
// Head of Production hanya proyek yang BELUM instalasi (masih ada item di
// produksi/pengiriman); yang semua itemnya sudah lewat ke instalasi disembunyikan.
// cache(): layout dan page dalam satu permintaan memakai hasil yang sama (kuncinya nilai primitif
// supaya objek `staf` yang berbeda tapi isinya sama tetap kena cache).
export const ambilProyekStaf = (staf) => proyekStaf(staf.id, staf.role, staf.peran, staf.nama);
const proyekStaf = cache(async (id, role, peran, nama) => {
  const staf = { id, role, peran, nama };
  let q = db().from("portal_proyek").select("*").order("aktif", { ascending: false }).order("created_at", { ascending: false });
  if (staf.role === "TUKANG") {
    const tim = await hasil(db().from("portal_item").select("proyek_id, tim").not("tim", "is", null));
    const ids = [...new Set(tim.filter((i) => timSaya(staf, i)).map((i) => i.proyek_id))];
    if (!ids.length) return [];
    q = q.in("id", ids);
  }
  const proyek = await hasil(q);
  if (staf.peran !== "HEAD_OF_PRODUCTION") return proyek;

  const items = await ambilItem(proyek);
  return proyek.filter((p) => !sudahInstalasi(items.filter((i) => i.proyek_id === p.id)));
});

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
  const url = await urlFotoItem(rows.map((t) => t.bukti).filter(Boolean)).catch(() => ({}));
  return rows.map((t) => ({
    bukti: t.bukti || null, bukti_url: url[t.bukti] || null,
    id: t.id, urutan: t.urutan, jenis: t.jenis || "produksi", label: t.label, persen: t.persen,
    jatuh_tempo: t.jatuh_tempo, lunas_tgl: t.lunas_tgl, dibayar: t.dibayar ?? null,
  }));
}

// Termin semua proyek untuk label pembayaran di kartu proyek (khusus admin):
// { [proyekId]: [termin urut `urutan`] }.
export async function ambilTerminSemua() {
  const rows = await hasil(db().from("portal_termin").select("*").order("urutan"));
  const out = {};
  for (const t of rows) (out[t.proyek_id] ||= []).push(t);
  return out;
}

// Addons / penambahan biaya (supabase/add_portal_addon.sql). Tabel belum dibuat -> kosong.
export async function ambilAddon(proyekId) {
  try {
    const rows = await hasil(db().from("portal_addon").select("*").eq("proyek_id", proyekId).order("created_at"));
    return rows.map((a) => ({ id: a.id, nama: a.nama, nilai: Number(a.nilai), lunas_tgl: a.lunas_tgl }));
  } catch {
    return [];
  }
}

// Link rahasia klien; `id` = token.
export async function ambilKlien(proyekId) {
  const rows = await hasil(
    db().from("portal_link").select("token, nama, created_at").eq("proyek_id", proyekId).order("created_at")
  );
  return rows.map(({ token, ...r }) => ({ id: token, ...r }));
}

// Baris portal_progres -> { progres: { [tahap]: tanggal }, porsi: { [tahap]: persen } }.
// Baris tanpa persen (sebelum kolomnya ada) = 100.
export const bacaProgres = (rows) => ({
  progres: Object.fromEntries(rows.map((g) => [g.tahap, g.selesai_tgl])),
  porsi: Object.fromEntries(rows.map((g) => [g.tahap, g.persen == null ? 100 : Number(g.persen)])),
});

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

// Item BOQ + progres: [{ ...portal_item, progres: { [tahap]: "YYYY-MM-DD" }, porsi: { [tahap]: persen } }]
// `proyek` = baris portal_proyek. bobot_tahap (khusus item kalau ada, selain
// itu bobot jenisnya) dan berat (penimbang pilihan proyeknya) ikut ditempel
// supaya hitungan di lib/portal/progresBoq.js memakai pengaturan admin, di
// server maupun di browser. select("*") supaya tetap jalan sebelum kolom
// bobot_tahap ada (supabase/add_portal_bobot_item.sql); portal_progres(*)
// supaya tetap jalan sebelum kolom persen ada (add_portal_progres_persen.sql).
export async function ambilItem(proyek) {
  if (!proyek.length) return [];
  const [bobot, rows] = await Promise.all([ambilBobotTahap(), ambilItemMentah(proyek.map((p) => p.id))]);
  return susunItem(proyek, rows, bobot);
}

// Baris portal_item + portal_progres apa adanya. `proyekIds` null = semua proyek, jadi bisa
// diminta berbarengan dengan daftar proyeknya (halaman yang butuh semua proyek tidak perlu
// menunggu daftar itu dulu: satu bolak-balik ke database lebih sedikit).
export function ambilItemMentah(proyekIds) {
  let q = db().from("portal_item").select("*, portal_progres(*)");
  if (proyekIds) q = q.in("proyek_id", proyekIds);
  return hasil(q.order("urutan").order("created_at"));
}

// Susun item siap pakai (progres, bobot, berat). Item proyek yang tidak ada di `proyek` dibuang.
export function susunItem(proyek, rows, bobot) {
  const items = rows.map(({ portal_progres, ...i }) => ({
    ...i,
    bobot_tahap: i.bobot_tahap || bobot[i.jenis] || null,
    bobot_khusus: !!i.bobot_tahap,
    ...bacaProgres(portal_progres),
  }));
  return proyek.flatMap((p) => beriBerat(items.filter((i) => i.proyek_id === p.id), p.timbang_harga));
}

// Pencatat progres terbaru tiap proyek: { [proyekId]: { oleh, at } }. Hanya untuk
// halaman admin; proyek tanpa catatan (atau pencatat sudah dihapus) tidak ikut.
export async function ambilPengubahTerakhir() {
  const out = {};
  // Satu query (terbaru dulu) lalu dipilah per proyek; dulu satu query per proyek.
  const rows = await hasil(
    db().from("portal_progres")
      .select("dicatat_at, pencatat:dicatat_oleh(name), portal_item!inner(proyek_id)")
      .order("dicatat_at", { ascending: false })
      .limit(2000)
  ).catch(() => []);
  for (const g of rows) {
    const id = g.portal_item?.proyek_id;
    if (id && !out[id] && g.pencatat?.name) out[id] = { oleh: g.pencatat.name, at: g.dicatat_at };
  }
  return out;
}
