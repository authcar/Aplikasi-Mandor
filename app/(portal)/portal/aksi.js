"use server";
// Semua perubahan data dari area staf portal. Hak akses dicek di sini (tabel
// portal_* tidak punya policy RLS, lihat lib/portal/db.js).
// Tiap aksi mengembalikan {} atau { error } supaya pesan tampil di UI.
import { randomBytes } from "crypto";
import { db, hasil } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilProyek } from "@/lib/portal/data";
import { JENIS, TAHAP } from "@/lib/portal/progresBoq";

const pilih = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

const F_PROYEK = ["nama", "kode", "klien_nama", "lokasi", "mulai", "deadline", "supervisor_id", "aktif"];
const F_ITEM = ["area", "kode", "nama", "jenis", "qty", "satuan", "dimensi", "harga", "bobot", "urutan"];
const F_TERMIN = ["urutan", "label", "persen", "jatuh_tempo", "lunas_tgl"];

async function jalan(fn, { admin = true } = {}) {
  try {
    const { staf } = await ambilStaf();
    if (!staf) throw new Error("Bukan staf.");
    if (admin && staf.role !== "ADMIN") throw new Error("Hanya admin.");
    return (await fn(staf)) || {};
  } catch (e) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    return { error: e.message || "Terjadi kesalahan." };
  }
}

function cekItem(r) {
  if (r.jenis && !JENIS.includes(r.jenis)) throw new Error("Jenis tidak valid.");
  if ("bobot" in r && !(Number(r.bobot) > 0)) throw new Error("Bobot harus > 0.");
  return r;
}

function cekTermin(r) {
  if ("persen" in r && !(r.persen > 0 && r.persen <= 100)) throw new Error("Persen harus 1–100.");
  return r;
}

const ubah = (tabel, id, patch) => hasil(db().from(tabel).update(patch).eq("id", id)).then(() => {});
const hapus = (tabel, id) => hasil(db().from(tabel).delete().eq("id", id)).then(() => {});

/* ---------- Proyek ---------- */
export async function buatProyek(f) {
  return jalan(async (staf) => {
    if (!f.nama?.trim()) throw new Error("Nama proyek wajib.");
    const p = await hasil(
      db().from("portal_proyek").insert({ ...pilih(f, F_PROYEK), aktif: true, created_by: staf.id }).select("id").single()
    );
    return { id: p.id };
  });
}

export async function ubahProyek(id, patch) {
  return jalan(() => ubah("portal_proyek", id, pilih(patch, F_PROYEK)));
}

/* ---------- Progres (admin & supervisor proyek) ---------- */
export async function setProgres(itemId, tahap, tanggal) {
  return jalan(async (staf) => {
    const item = await hasil(db().from("portal_item").select("proyek_id, jenis").eq("id", itemId).maybeSingle());
    if (!item) throw new Error("Item tidak ditemukan.");
    if (!bolehProyek(staf, await ambilProyek(item.proyek_id))) throw new Error("Tidak punya akses ke proyek ini.");
    if (!TAHAP[item.jenis]?.some((s) => s.k === tahap)) throw new Error("Tahap tidak valid.");
    if (!tanggal) return void (await hasil(db().from("portal_progres").delete().eq("item_id", itemId).eq("tahap", tahap)));
    await hasil(
      db().from("portal_progres").upsert({
        item_id: itemId, tahap, selesai_tgl: tanggal, dicatat_oleh: staf.id, dicatat_at: new Date().toISOString(),
      })
    );
  }, { admin: false });
}

/* ---------- Item BOQ ---------- */
export async function tambahItem(proyekId, rows) {
  return jalan(async () => {
    const baru = rows.filter((r) => r.nama).map((r) => ({ ...cekItem(pilih(r, F_ITEM)), proyek_id: proyekId }));
    if (baru.length) await hasil(db().from("portal_item").insert(baru));
  });
}

export async function ubahItem(id, patch) {
  return jalan(() => ubah("portal_item", id, cekItem(pilih(patch, F_ITEM))));
}

// Progres item ikut terhapus (on delete cascade).
export async function hapusItem(id) {
  return jalan(() => hapus("portal_item", id));
}

/* ---------- Termin ---------- */
export async function tambahTermin(proyekId, rows) {
  return jalan(async () => {
    await hasil(db().from("portal_termin").insert(rows.map((r) => ({ ...cekTermin(pilih(r, F_TERMIN)), proyek_id: proyekId }))));
  });
}

export async function ubahTermin(id, patch) {
  return jalan(() => ubah("portal_termin", id, cekTermin(pilih(patch, F_TERMIN))));
}

export async function hapusTermin(id) {
  return jalan(() => hapus("portal_termin", id));
}

/* ---------- Link klien ---------- */
export async function buatLink(proyekId, nama) {
  return jalan(async () => {
    if (!(await ambilProyek(proyekId))) throw new Error("Proyek tidak ditemukan.");
    const token = randomBytes(32).toString("base64url");
    await hasil(db().from("portal_link").insert({ token, proyek_id: proyekId, nama: nama?.trim() || null }));
    return { token };
  });
}

export async function cabutLink(token) {
  return jalan(async () => {
    await hasil(db().from("portal_link").delete().eq("token", token));
  });
}
