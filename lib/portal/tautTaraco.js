// Jembatan Project Tracker <-> Taraco Project Management. Server-only.
//
// 1. BoQ diunggah dari website Taraco PM -> proyek tracker dibuatkan/ditautkan
//    lewat portal_proyek.taraco_id (pastikanProyekTaraco).
// 2. Progres tracker didorong balik ke kartu Taraco: projects.tracker_progress
//    (0..100) dan projects.tracker_items (jumlah item yang dihitung). Kartu di
//    board Taraco memakainya untuk progress bar-nya.
//    Migrasi di sisi Taraco: supabase/migration_tracker_link.sql.
//
// Mendorong progres tidak pernah boleh menggagalkan aksi pemanggilnya: gagal
// apa pun (jaringan, kolom belum dimigrasi) diam saja, dan sinkron berkala
// (dorongSemuaProgres, dipanggil dari syncTaraco.js) memperbaikinya.
import { createTaracoClient } from "@/lib/supabase/taraco";
import { db, hasil } from "./db";
import { ambilItem, ambilProyek } from "./data";
import { persenProyek, itemProgres } from "./progresBoq";

const normal = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const bulat = (v) => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;

// Anggota Taraco yang boleh mengunggah BoQ: MASTER dan SALES yang aktif.
// token = access token Supabase milik Taraco PM (dikirim browser Taraco).
export async function anggotaDariToken(token) {
  if (!token) return null;
  const taraco = createTaracoClient();
  const { data, error } = await taraco.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return null;
  const { data: m } = await taraco.from("members").select("email, name, role, active").eq("email", email).maybeSingle();
  return m?.active && ["MASTER", "SALES"].includes(m.role) ? m : null;
}

// Proyek tracker untuk satu proyek Taraco: yang sudah tertaut dipakai lagi; proyek
// manual bernama sama ditautkan (bukan diduplikasi); selain itu dibuat baru dari
// data kartu Taraco. Mengunggah BoQ = permintaan eksplisit, jadi proyek yang
// pernah dihapus admin (portal_taraco_lewat) boleh dibuat lagi.
// -> { id, baru, nama, jumlahItem }
export async function pastikanProyekTaraco(taracoId) {
  const taraco = createTaracoClient();
  const { data: p, error } = await taraco
    .from("projects")
    .select("id, name, code, client, location, start_date, due_date, supervisor")
    .eq("id", taracoId)
    .maybeSingle();
  if (error) throw new Error("Data proyek Taraco tidak terbaca.");
  if (!p) throw new Error("Proyek tidak ditemukan di Taraco.");

  const jumlahItem = async (id) => {
    const { count } = await db().from("portal_item").select("id", { count: "exact", head: true }).eq("proyek_id", id);
    return count || 0;
  };

  const ada = await hasil(db().from("portal_proyek").select("id, nama").eq("taraco_id", p.id).maybeSingle());
  if (ada) return { id: ada.id, baru: false, nama: ada.nama, jumlahItem: await jumlahItem(ada.id) };

  await db().from("portal_taraco_lewat").delete().eq("taraco_id", p.id);

  const manual = (await hasil(db().from("portal_proyek").select("id, nama").is("taraco_id", null)))
    .find((r) => normal(r.nama) === normal(p.name));
  if (manual) {
    await hasil(db().from("portal_proyek").update({ taraco_id: p.id }).eq("id", manual.id));
    return { id: manual.id, baru: false, nama: manual.nama, jumlahItem: await jumlahItem(manual.id) };
  }

  const sv = normal(p.supervisor)
    ? (await hasil(db().from("profiles").select("id, name").eq("role", "SUPERVISOR"))).find((s) => normal(s.name) === normal(p.supervisor))
    : null;
  const baru = await hasil(
    db().from("portal_proyek").insert({
      taraco_id: p.id,
      nama: p.name,
      kode: p.code || null,
      klien_nama: p.client || null,
      lokasi: p.location || null,
      deadline: p.due_date || null,
      supervisor_id: sv?.id || null,
      aktif: true,
      ...(p.start_date ? { mulai: p.start_date } : {}),
    }).select("id, nama").single()
  );
  return { id: baru.id, baru: true, nama: baru.nama, jumlahItem: 0 };
}

async function tulis(rows) {
  const taraco = createTaracoClient();
  for (const r of rows) {
    const { error } = await taraco.from("projects").update({ tracker_progress: r.persen, tracker_items: r.n }).eq("id", r.taraco_id);
    if (error) return false; // kolom belum dimigrasi: berhenti, jangan ulangi untuk tiap proyek
  }
  return true;
}

// Dorong progres satu proyek tracker ke kartu Taraco-nya (kalau tertaut).
export async function dorongProgres(proyekId) {
  try {
    const p = await ambilProyek(proyekId);
    if (!p?.taraco_id) return;
    const items = await ambilItem([p]);
    await tulis([{ taraco_id: p.taraco_id, persen: bulat(persenProyek(items)), n: items.filter(itemProgres).length }]);
  } catch {}
}

// Semua proyek tertaut sekaligus; hanya yang angkanya beda dengan di Taraco yang
// ditulis. Jaring pengaman untuk perubahan yang tidak lewat aksi di atas
// (mis. bobot tahap per jenis diubah, item dihapus lewat proyek lain).
// Menautkan otomatis proyek tracker yang belum punya taraco_id ke kartu Taraco-nya,
// supaya SEMUA proyek tracker ikut tersinkron progresnya. Hanya menautkan kalau
// cocoknya tidak meragukan:
//   1. nama sama persis (spasi/huruf besar-kecil diabaikan) dengan tepat satu kartu, atau
//   2. kode sama dengan tepat satu kartu, dan kode itu hanya dipakai satu proyek tracker.
// Kartu yang sudah diklaim proyek lain, atau yang pernah dihapus admin
// (portal_taraco_lewat), dilewati. Yang meragukan dibiarkan: tautkan manual.
async function tautkanOtomatis() {
  const [portal, lewat] = await Promise.all([
    hasil(db().from("portal_proyek").select("id, nama, kode, taraco_id")),
    hasil(db().from("portal_taraco_lewat").select("taraco_id")),
  ]);
  const belum = portal.filter((p) => !p.taraco_id);
  if (!belum.length) return;
  const diklaim = new Set(portal.filter((p) => p.taraco_id).map((p) => p.taraco_id));
  const dilewati = new Set(lewat.map((r) => r.taraco_id));
  const taraco = createTaracoClient();
  const { data: kartu, error } = await taraco.from("projects").select("id, name, code").limit(5000);
  if (error || !kartu) return;
  const bebas = kartu.filter((k) => !diklaim.has(k.id) && !dilewati.has(k.id));
  const kodeNorm = (v) => String(v || "").trim().toLowerCase();
  const pakaiKode = (kode) => belum.filter((p) => kodeNorm(p.kode) === kode).length;
  for (const p of belum) {
    const dariNama = bebas.filter((k) => normal(k.name) === normal(p.nama));
    let pilih = dariNama.length === 1 ? dariNama[0] : null;
    if (!pilih && dariNama.length === 0 && kodeNorm(p.kode) && pakaiKode(kodeNorm(p.kode)) === 1) {
      const dariKode = bebas.filter((k) => kodeNorm(k.code) === kodeNorm(p.kode));
      if (dariKode.length === 1) pilih = dariKode[0];
    }
    if (!pilih) continue;
    const { error: e } = await db().from("portal_proyek").update({ taraco_id: pilih.id }).eq("id", p.id).is("taraco_id", null);
    if (!e) bebas.splice(bebas.indexOf(pilih), 1);
  }
}

export async function dorongSemuaProgres() {
  try {
    try { await tautkanOtomatis(); } catch {}
    const proyek = (await hasil(db().from("portal_proyek").select("*"))).filter((p) => p.taraco_id);
    if (!proyek.length) return;
    const taraco = createTaracoClient();
    const { data: kini, error } = await taraco.from("projects").select("id, tracker_progress, tracker_items").in("id", proyek.map((p) => p.taraco_id));
    if (error) return;
    const sekarang = new Map(kini.map((r) => [r.id, r]));
    const items = await ambilItem(proyek);
    const ubah = [];
    for (const p of proyek) {
      const its = items.filter((i) => i.proyek_id === p.id);
      const persen = bulat(persenProyek(its));
      const n = its.filter(itemProgres).length;
      const k = sekarang.get(p.taraco_id);
      if (!k) continue;
      if (k.tracker_progress == null || Number(k.tracker_progress) !== persen || k.tracker_items !== n) ubah.push({ taraco_id: p.taraco_id, persen, n });
    }
    await tulis(ubah);
  } catch {}
}

// Proyek tracker dihapus -> kartu Taraco tidak lagi menampilkan progres tracker.
export async function lepasTautanTaraco(taracoId) {
  try {
    await createTaracoClient().from("projects").update({ tracker_progress: null, tracker_items: null }).eq("id", taracoId);
  } catch {}
}
