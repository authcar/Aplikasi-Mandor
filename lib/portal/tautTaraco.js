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

// Kartu tambahan (tabel opsional portal_taraco_tambahan): kalau tabelnya belum dibuat, diabaikan.
async function kartuTambahan(proyekIds) {
  try {
    const { data, error } = await db().from("portal_taraco_tambahan").select("taraco_id, proyek_id").in("proyek_id", proyekIds);
    return error ? [] : data || [];
  } catch {
    return [];
  }
}

// Dorong progres satu proyek tracker ke semua kartu Taraco-nya (utama + tambahan). Melempar error.
export async function dorongProgresKetat(proyekId) {
  const p = await ambilProyek(proyekId);
  if (!p?.taraco_id) return null;
  const items = await ambilItem([p]);
  const persen = bulat(persenProyek(items));
  const n = items.filter(itemProgres).length;
  const ids = [p.taraco_id, ...(await kartuTambahan([p.id])).map((r) => r.taraco_id)];
  const taraco = createTaracoClient();
  const { data, error } = await taraco
    .from("projects")
    .update({ tracker_progress: persen, tracker_items: n })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(`Taraco menolak update progres: ${error.message}`);
  if (!data || !data.length) throw new Error("Kartu Taraco dengan ID itu tidak ditemukan.");
  return { persen, n, kartu: data.length };
}

// Versi senyap: tidak boleh menggagalkan aksi pemanggilnya.
export async function dorongProgres(proyekId) {
  try {
    await dorongProgresKetat(proyekId);
  } catch {}
}

// Kode / klien / lokasi / deadline yang masih kosong di proyek tracker diisi dari kartu Taraco
// (mis. diisi di Taraco sesudah BoQ diunggah). Yang sudah terisi tidak ditimpa: itu hasil edit admin.
async function isiKosongDariTaraco(proyek) {
  const perlu = proyek.filter((p) => p.taraco_id && (!p.kode || !p.klien_nama || !p.lokasi || !p.deadline));
  if (!perlu.length) return;
  const taraco = createTaracoClient();
  const { data, error } = await taraco.from("projects").select("id, code, client, location, due_date").in("id", perlu.map((p) => p.taraco_id));
  if (error || !data) return;
  const kartu = new Map(data.map((r) => [r.id, r]));
  for (const p of perlu) {
    const k = kartu.get(p.taraco_id);
    if (!k) continue;
    const patch = {};
    if (!p.kode && k.code) patch.kode = k.code;
    if (!p.klien_nama && k.client) patch.klien_nama = k.client;
    if (!p.lokasi && k.location) patch.lokasi = k.location;
    if (!p.deadline && k.due_date) patch.deadline = k.due_date;
    if (Object.keys(patch).length) {
      await db().from("portal_proyek").update(patch).eq("id", p.id);
      Object.assign(p, patch);
    }
  }
}

// Semua proyek tertaut sekaligus; hanya yang angkanya beda dengan di Taraco yang
// ditulis. Jaring pengaman untuk perubahan yang tidak lewat aksi di atas
// (mis. bobot tahap per jenis diubah, item dihapus lewat proyek lain).
export async function dorongSemuaProgres() {
  try {
    const proyek = (await hasil(db().from("portal_proyek").select("*"))).filter((p) => p.taraco_id);
    if (!proyek.length) return;
    await isiKosongDariTaraco(proyek).catch(() => {});
    const tambahan = await kartuTambahan(proyek.map((p) => p.id));
    // satu baris per (proyek tracker, kartu Taraco)
    const target = [
      ...proyek.map((p) => ({ p, taraco_id: p.taraco_id })),
      ...tambahan.map((r) => ({ p: proyek.find((x) => x.id === r.proyek_id), taraco_id: r.taraco_id })).filter((t) => t.p),
    ];
    const taraco = createTaracoClient();
    const { data: kini, error } = await taraco.from("projects").select("id, tracker_progress, tracker_items").in("id", target.map((t) => t.taraco_id));
    if (error) return;
    const sekarang = new Map(kini.map((r) => [r.id, r]));
    const items = await ambilItem(proyek);
    const ubah = [];
    for (const { p, taraco_id } of target) {
      const its = items.filter((i) => i.proyek_id === p.id);
      const persen = bulat(persenProyek(its));
      const n = its.filter(itemProgres).length;
      const k = sekarang.get(taraco_id);
      if (!k) continue;
      if (k.tracker_progress == null || Number(k.tracker_progress) !== persen || k.tracker_items !== n) ubah.push({ taraco_id, persen, n });
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
