// Menyimpan item BOQ ke satu proyek portal. Server-only. Dipakai server action
// (app/(portal)/portal/aksi.js) dan route impor BoQ dari website Taraco Project
// Management (app/api/portal/impor-boq), supaya aturannya sama persis.
import { db, hasil } from "./db";
import { hapusFotoItem } from "./fotoItem";
import { hapusFotoProgres } from "./progresFoto";
import { JENIS } from "./progresBoq";

export const pilih = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

export const F_ITEM = ["area", "kode", "nama", "jenis", "qty", "satuan", "dimensi", "harga", "harga_satuan", "tim", "bobot", "urutan", "foto", "hanya_jasa"];

export function cekItem(r) {
  if (r.jenis && !JENIS.includes(r.jenis)) throw new Error("Jenis tidak valid.");
  if ("bobot" in r && !(Number(r.bobot) > 0)) throw new Error("Bobot harus > 0.");
  if ("nama" in r && !String(r.nama || "").trim()) throw new Error("Nama item wajib.");
  if ("area" in r && !String(r.area || "").trim()) throw new Error("Area wajib.");
  if ("qty" in r && !(Number(r.qty) > 0)) throw new Error("Qty harus > 0.");
  if (r.harga != null && !(Number(r.harga) >= 0)) throw new Error("Total jasa pekerja tidak valid.");
  if (r.harga_satuan != null && !(Number(r.harga_satuan) >= 0)) throw new Error("Harga satuan tidak valid.");
  if ("foto" in r && (!Array.isArray(r.foto) || r.foto.length > 5 || r.foto.some((p) => typeof p !== "string")))
    throw new Error("foto item tidak valid.");
  if ("tim" in r) r.tim = String(r.tim || "").trim() || null;
  return r;
}

// Foto item harus milik proyek ini (path diawali id proyek, lihat api/portal/item-foto).
export function cekFoto(rows, proyekId) {
  // Insert massal mengisi kolom yang tak ada di sebuah baris dengan NULL (bukan
  // default), padahal portal_item.foto not null: samakan semua baris.
  if (rows.some((r) => r.foto)) for (const r of rows) r.foto ||= [];
  if (rows.some((r) => (r.foto || []).some((p) => !p.startsWith(`${proyekId}/`) || p.includes(".."))))
    throw new Error("foto item bukan milik proyek ini.");
}

const siapkan = (rows, proyekId) => {
  const baru = rows.filter((r) => r.nama).map((r) => ({ ...cekItem(pilih(r, F_ITEM)), proyek_id: proyekId }));
  cekFoto(baru, proyekId);
  return baru;
};

// Tambahkan item di belakang item yang sudah ada.
export async function tambahItemProyek(proyekId, rows) {
  const baru = siapkan(rows, proyekId);
  if (baru.length) await hasil(db().from("portal_item").insert(baru));
}

// Ganti hanya item yang dicentang (`ids`); item lain beserta progresnya tetap.
// Urutan sama dengan gantiItemProyek: simpan yang baru dulu, baru hapus yang lama.
export async function gantiItemPilihan(proyekId, ids, rows) {
  const baru = siapkan(rows, proyekId);
  if (!baru.length) throw new Error("Tidak ada item pengganti.");
  const pilihan = new Set(ids);
  if (!pilihan.size) throw new Error("Pilih item yang mau diganti.");
  const lama = (await hasil(db().from("portal_item").select("*").eq("proyek_id", proyekId))).filter((i) => pilihan.has(i.id));
  if (lama.length !== pilihan.size) throw new Error("Daftar item sudah berubah. Buka ulang dialognya lalu pilih lagi.");
  await hasil(db().from("portal_item").insert(baru));
  await hapusItemLama(lama);
}

async function hapusItemLama(lama) {
  await hapusFotoProgres({ itemIds: lama.map((i) => i.id) }); // berkasnya; barisnya ikut terhapus bersama itemnya
  for (let n = 0; n < lama.length; n += 100)
    await hasil(db().from("portal_item").delete().in("id", lama.slice(n, n + 100).map((i) => i.id)));
  await hapusFotoItem(lama.flatMap((i) => i.foto || []));
}

// Ganti seluruh BOQ proyek. Item baru disimpan dulu, baru yang lama dihapus,
// supaya BOQ lama tidak hilang kalau penyimpanan gagal di tengah jalan.
// Progres item lama ikut terhapus (on delete cascade).
export async function gantiItemProyek(proyekId, rows) {
  const baru = siapkan(rows, proyekId);
  if (!baru.length) throw new Error("Tidak ada item pengganti.");
  const lama = await hasil(db().from("portal_item").select("*").eq("proyek_id", proyekId));
  await hasil(db().from("portal_item").insert(baru));
  await hapusItemLama(lama);
}
