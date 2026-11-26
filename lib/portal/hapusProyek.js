// Hapus permanen satu proyek tracker beserta isinya. Server-only; pemanggil wajib
// sudah memeriksa hak aksesnya (aksi.js: admin, impor-boq: MASTER/SALES Taraco).
// Item, progres, termin, dan link klien ikut terhapus (on delete cascade).
// Tiap round trip ke database itu mahal, jadi query yang saling bebas dijalankan bersamaan.
import { db, hasil } from "./db";
import { ambilProyek } from "./data";
import { hapusFotoItem } from "./fotoItem";
import { hapusFotoProgres } from "./progresFoto";
import { hapusFotoDefect } from "./defect";
import { hapusFileBoq } from "./boqFile";
import { lepasTautanTaraco } from "./tautTaraco";

export async function hapusSatuProyek(id) {
  // Proyek hasil tarikan Taraco: catat supaya sinkron tidak membuatnya lagi.
  // Gagal (tabelnya belum dibuat) tidak boleh menghalangi penghapusan.
  const proyek = await ambilProyek(id);
  const taracoId = proyek?.taraco_id;
  // Kartu tambahan (tabel opsional): lepas juga, lalu hapus barisnya.
  const tambahan = (async () => {
    try {
      const { data } = await db().from("portal_taraco_tambahan").select("taraco_id").eq("proyek_id", id);
      await Promise.all([
        ...(data || []).map((r) => lepasTautanTaraco(r.taraco_id)),
        // dicatat juga, supaya sinkron tidak membuat proyek baru untuk kartu tambahan
        ...(data || []).map((r) => db().from("portal_taraco_lewat").upsert({ taraco_id: r.taraco_id })),
        db().from("portal_taraco_tambahan").delete().eq("proyek_id", id),
      ]);
    } catch {}
  })();
  const utama = taracoId
    ? Promise.all([
        db().from("portal_taraco_lewat").upsert({ taraco_id: taracoId }),
        lepasTautanTaraco(taracoId), // kartu di Taraco kembali tanpa progres tracker
      ]).catch(() => {})
    : null;
  // Foto: baca semua barisnya sekaligus, lalu hapus berkasnya sekaligus.
  const [fotoItem, termin] = await Promise.all([
    hasil(db().from("portal_item").select("*").eq("proyek_id", id)),
    hasil(db().from("portal_termin").select("*").eq("proyek_id", id)),
  ]);
  await Promise.all([
    hapusFotoItem([...fotoItem.flatMap((i) => i.foto || []), ...termin.map((t) => t.bukti)]),
    hapusFotoDefect(id), // baris defect ikut terhapus (cascade), fotonya tidak
    hapusFotoProgres({ proyekId: id }),
    hapusFileBoq([proyek?.boq_file]),
    tambahan,
    utama,
  ]);
  await hasil(db().from("portal_proyek").delete().eq("id", id));
}
