// Hapus permanen satu proyek tracker beserta isinya. Server-only; pemanggil wajib
// sudah memeriksa hak aksesnya (aksi.js: admin, impor-boq: MASTER/SALES Taraco).
// Item, progres, termin, dan link klien ikut terhapus (on delete cascade).
import { db, hasil } from "./db";
import { ambilProyek } from "./data";
import { hapusFotoItem } from "./fotoItem";
import { hapusFotoProgres } from "./progresFoto";
import { hapusFotoDefect } from "./defect";
import { lepasTautanTaraco } from "./tautTaraco";

export async function hapusSatuProyek(id) {
  // Proyek hasil tarikan Taraco: catat supaya sinkron tidak membuatnya lagi.
  // Gagal (tabelnya belum dibuat) tidak boleh menghalangi penghapusan.
  const taracoId = (await ambilProyek(id))?.taraco_id;
  if (taracoId) {
    await db().from("portal_taraco_lewat").upsert({ taraco_id: taracoId });
    await lepasTautanTaraco(taracoId); // kartu di Taraco kembali tanpa progres tracker
  }
  // Kartu tambahan (tabel opsional): lepas juga, lalu hapus barisnya.
  try {
    const { data } = await db().from("portal_taraco_tambahan").select("taraco_id").eq("proyek_id", id);
    for (const r of data || []) await lepasTautanTaraco(r.taraco_id);
    await db().from("portal_taraco_tambahan").delete().eq("proyek_id", id);
  } catch {}
  const fotoItem = await hasil(db().from("portal_item").select("*").eq("proyek_id", id));
  await hapusFotoItem(fotoItem.flatMap((i) => i.foto || []));
  await hapusFotoItem((await hasil(db().from("portal_termin").select("*").eq("proyek_id", id))).map((t) => t.bukti));
  await hapusFotoDefect(id); // baris defect ikut terhapus (cascade), fotonya tidak
  await hapusFotoProgres({ proyekId: id });
  await hasil(db().from("portal_proyek").delete().eq("id", id));
}
