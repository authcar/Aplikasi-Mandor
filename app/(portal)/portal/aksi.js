"use server";
// Semua perubahan data dari area staf portal. Hak akses dicek di sini (tabel
// portal_* tidak punya policy RLS, lihat lib/portal/db.js).
// Tiap aksi mengembalikan {} atau { error } supaya pesan tampil di UI.
import { randomBytes } from "crypto";
import { db, hasil } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilProyek } from "@/lib/portal/data";
import { JENIS, TAHAP } from "@/lib/portal/progresBoq";
import { JENIS_TERMIN, terminStandar } from "@/lib/portal/format";

const pilih = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

const F_PROYEK = ["nama", "kode", "klien_nama", "lokasi", "mulai", "deadline", "supervisor_id", "aktif", "timbang_harga", "nilai_perancangan"];
const F_ITEM = ["area", "kode", "nama", "jenis", "qty", "satuan", "dimensi", "harga", "bobot", "urutan"];
const F_TERMIN = ["urutan", "jenis", "label", "persen", "jatuh_tempo", "lunas_tgl", "dibayar"];

async function jalan(fn, { admin = true } = {}) {
  try {
    const { staf } = await ambilStaf();
    if (!staf) throw new Error("Bukan staf.");
    if (admin && staf.role !== "ADMIN") throw new Error("Hanya admin.");
    return (await fn(staf)) || {};
  } catch (e) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    // Kolom baru belum dibuat di Supabase.
    if (/could not find the '\w+' column|column .* does not exist/i.test(e.message || ""))
      return { error: "kolomnya belum ada di database. Jalankan supabase/add_portal_pembayaran.sql dan add_portal_termin_jenis.sql di Supabase dulu." };
    return { error: e.message || "Terjadi kesalahan." };
  }
}

function cekProyek(r) {
  if (r.nilai_perancangan != null && !(Number(r.nilai_perancangan) >= 0)) throw new Error("Nilai perancangan tidak valid.");
  return r;
}

function cekItem(r) {
  if (r.jenis && !JENIS.includes(r.jenis)) throw new Error("Jenis tidak valid.");
  if ("bobot" in r && !(Number(r.bobot) > 0)) throw new Error("Bobot harus > 0.");
  if ("nama" in r && !String(r.nama || "").trim()) throw new Error("Nama item wajib.");
  if ("area" in r && !String(r.area || "").trim()) throw new Error("Area wajib.");
  if ("qty" in r && !(Number(r.qty) > 0)) throw new Error("Qty harus > 0.");
  if (r.harga != null && !(Number(r.harga) >= 0)) throw new Error("Harga tidak valid.");
  return r;
}

function cekTermin(r) {
  if ("jenis" in r && !JENIS_TERMIN.some(([k]) => k === r.jenis)) throw new Error("Jenis termin tidak valid.");
  if ("persen" in r && !(r.persen > 0 && r.persen <= 100)) throw new Error("Persen harus 1–100.");
  if (r.dibayar != null && !(Number(r.dibayar) >= 0)) throw new Error("Nominal diterima tidak valid.");
  return r;
}

// Total persen termin satu jenis (perancangan / produksi) tidak boleh lewat
// 100 (sisa tagihan jadi minus).
async function cekTotalTermin(proyekId, jenis, tambahan, kecualiId) {
  const rows = await hasil(db().from("portal_termin").select("id, persen").eq("proyek_id", proyekId).eq("jenis", jenis));
  const total = rows.filter((t) => t.id !== kecualiId).reduce((a, t) => a + Number(t.persen), 0) + tambahan;
  if (total > 100.001)
    throw new Error(`total termin ${jenis} jadi ${Math.round(total * 100) / 100}%, maksimal 100%. Kurangi termin lain dulu.`);
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
  return jalan(() => ubah("portal_proyek", id, cekProyek(pilih(patch, F_PROYEK))));
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

// Ganti seluruh BOQ proyek. Item baru disimpan dulu, baru yang lama dihapus,
// supaya BOQ lama tidak hilang kalau penyimpanan gagal di tengah jalan.
// Progres item lama ikut terhapus (on delete cascade).
export async function gantiItem(proyekId, rows) {
  return jalan(async () => {
    const baru = rows.filter((r) => r.nama).map((r) => ({ ...cekItem(pilih(r, F_ITEM)), proyek_id: proyekId }));
    if (!baru.length) throw new Error("Tidak ada item pengganti.");
    const lama = await hasil(db().from("portal_item").select("id").eq("proyek_id", proyekId));
    await hasil(db().from("portal_item").insert(baru));
    for (let n = 0; n < lama.length; n += 100)
      await hasil(db().from("portal_item").delete().in("id", lama.slice(n, n + 100).map((i) => i.id)));
  });
}

// Progres item ikut terhapus (on delete cascade).
export async function hapusItem(id) {
  return jalan(() => hapus("portal_item", id));
}

/* ---------- Termin ---------- */
export async function tambahTermin(proyekId, rows) {
  return jalan(async () => {
    const baru = rows.map((r) => ({ jenis: "produksi", ...cekTermin(pilih(r, F_TERMIN)), proyek_id: proyekId }));
    for (const [jenis] of JENIS_TERMIN) {
      const tambahan = baru.filter((r) => r.jenis === jenis).reduce((a, r) => a + Number(r.persen), 0);
      if (tambahan) await cekTotalTermin(proyekId, jenis, tambahan);
    }
    await hasil(db().from("portal_termin").insert(baru));
  });
}

// Ganti seluruh termin satu jenis dengan pola standar (lihat terminStandar).
// Ditolak kalau sudah ada pembayaran di jenis itu, supaya catatan bayar tidak hilang.
export async function buatTerminStandar(proyekId, jenis) {
  return jalan(async () => {
    if (!JENIS_TERMIN.some(([k]) => k === jenis)) throw new Error("Jenis termin tidak valid.");
    const p = await ambilProyek(proyekId);
    if (!p) throw new Error("Proyek tidak ditemukan.");
    const nilai = Number(p.nilai_perancangan) || 0;
    if (jenis === "perancangan" && !nilai) throw new Error("isi nilai jasa perancangan dulu.");
    const lama = await hasil(
      db().from("portal_termin").select("id, lunas_tgl, dibayar").eq("proyek_id", proyekId).eq("jenis", jenis)
    );
    if (lama.some((t) => t.lunas_tgl || Number(t.dibayar) > 0))
      throw new Error("sudah ada pembayaran di termin ini. Ubah persennya satu per satu.");
    await hasil(
      db().from("portal_termin").insert(
        terminStandar(jenis, nilai).map(([label, persen], n) => ({ proyek_id: proyekId, jenis, urutan: n, label, persen }))
      )
    );
    if (lama.length) await hasil(db().from("portal_termin").delete().in("id", lama.map((t) => t.id)));
  });
}

export async function ubahTermin(id, patch) {
  return jalan(async () => {
    // Jenis termin tidak diubah setelah dibuat.
    const { jenis, ...p } = cekTermin(pilih(patch, F_TERMIN));
    if ("persen" in p) {
      const t = await hasil(db().from("portal_termin").select("*").eq("id", id).maybeSingle());
      if (!t) throw new Error("Termin tidak ditemukan.");
      await cekTotalTermin(t.proyek_id, t.jenis || "produksi", Number(p.persen), id);
    }
    await ubah("portal_termin", id, p);
  });
}

export async function hapusTermin(id) {
  return jalan(() => hapus("portal_termin", id));
}

/* ---------- Bobot tahap (per jenis, semua proyek) ---------- */
// bobot = { [tahap]: persen } lengkap untuk satu jenis, berjumlah 100.
export async function simpanBobotTahap(jenis, bobot) {
  return jalan(async (staf) => {
    const tahap = TAHAP[jenis];
    if (!tahap) throw new Error("Jenis tidak valid.");
    const rows = tahap.map((s) => ({ jenis, tahap: s.k, bobot: Number(bobot?.[s.k]) }));
    if (rows.some((r) => !(r.bobot >= 0 && r.bobot <= 100))) throw new Error("Tiap tahap harus diisi 0–100.");
    const total = rows.reduce((a, r) => a + r.bobot, 0);
    if (Math.abs(total - 100) > 0.001) throw new Error(`Total harus 100%, sekarang ${total}%.`);
    await hasil(
      db().from("portal_bobot_tahap").upsert(rows.map((r) => ({ ...r, diubah_oleh: staf.id, diubah_at: new Date().toISOString() })))
    );
  });
}

// Hapus pengaturan -> jenis ini kembali memakai bobot bawaan.
export async function resetBobotTahap(jenis) {
  return jalan(async () => {
    if (!TAHAP[jenis]) throw new Error("Jenis tidak valid.");
    await hasil(db().from("portal_bobot_tahap").delete().eq("jenis", jenis));
  });
}

/* ---------- Link klien ---------- */
// Satu proyek satu link. Link selalu menampilkan data terbaru, jadi tidak perlu
// dibuat ulang; link baru hanya bisa dibuat setelah link lama dicabut.
export async function buatLink(proyekId, nama) {
  return jalan(async () => {
    if (!(await ambilProyek(proyekId))) throw new Error("Proyek tidak ditemukan.");
    const ada = await hasil(db().from("portal_link").select("token").eq("proyek_id", proyekId).limit(1));
    if (ada.length) throw new Error("proyek ini sudah punya link klien. Cabut link lama dulu kalau mau membuat yang baru.");
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
