import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, hasil, UUID } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilProyek } from "@/lib/portal/data";
import { TAHAP } from "@/lib/portal/progresBoq";
import { BUCKET_PROGRES, MAKS_FOTO_PROGRES } from "@/lib/portal/progresFoto";
import { lewatDeadline, tglTh } from "@/lib/portal/format";

export const dynamic = "force-dynamic";

const MAKS_BYTE_FOTO = 8 * 1024 * 1024; // foto sudah dikompres di browser (lib/gambar.js)
const MAKS_PER_UNGGAH = 10;
const gagal = (error, status = 400) => NextResponse.json({ error }, { status });

// POST /api/portal/progres-foto — admin/supervisor menambah foto progres satu
// item BOQ (boleh banyak). multipart: item_id, foto (1..10).
// Lewat route (bukan server action) karena batas ukuran server action 1 MB.
export async function POST(req) {
  const { staf } = await ambilStaf();
  if (!staf || staf.role === "TUKANG") return gagal("tidak punya akses.", 403);

  let form;
  try {
    form = await req.formData();
  } catch {
    return gagal("data tidak terbaca. Coba kirim ulang dengan foto lebih sedikit.");
  }
  const itemId = String(form.get("item_id") || "");
  const tahap = String(form.get("tahap") || "") || null; // opsional: foto untuk satu tahap
  const foto = form.getAll("foto").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!UUID.test(itemId)) return gagal("item tidak valid.");
  if (!foto.length) return gagal("pilih fotonya dulu.");
  if (foto.length > MAKS_PER_UNGGAH) return gagal(`maksimal ${MAKS_PER_UNGGAH} foto sekali unggah.`);
  if (foto.some((f) => !String(f.type).startsWith("image/"))) return gagal("lampiran harus berupa foto.");
  if (foto.some((f) => f.size > MAKS_BYTE_FOTO)) return gagal("ukuran foto terlalu besar.");

  try {
    const item = await hasil(db().from("portal_item").select("id, proyek_id, jenis").eq("id", itemId).maybeSingle());
    if (!item) return gagal("item tidak ditemukan.", 404);
    if (tahap && !(TAHAP[item.jenis] || TAHAP.HPL).some((s) => s.k === tahap)) return gagal("tahap tidak valid.");
    const p = await ambilProyek(item.proyek_id);
    if (!bolehProyek(staf, p)) return gagal("tidak punya akses ke proyek ini.", 403);
    if (lewatDeadline(p)) return gagal(`proyek sudah lewat deadline ${tglTh(p.deadline)}, jadi terkunci.`);

    let ada;
    try {
      ada = await hasil(db().from("portal_progres_foto").select("id").eq("item_id", itemId));
    } catch (e) {
      if (/could not find the table|does not exist|schema cache/i.test(e.message || ""))
        return gagal("tabel foto progres belum ada. Jalankan supabase/add_portal_progres_foto.sql di Supabase dulu.", 503);
      throw e;
    }
    if (ada.length + foto.length > MAKS_FOTO_PROGRES)
      return gagal(`foto progres maksimal ${MAKS_FOTO_PROGRES} per item (sudah ada ${ada.length}).`);

    const paths = [];
    try {
      for (const f of foto) {
        const ext = f.type === "image/png" ? "png" : "jpg";
        const path = `${item.proyek_id}/${itemId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
        const { error } = await db().storage.from(BUCKET_PROGRES).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
        if (error) {
          if (/bucket not found/i.test(error.message)) throw new Error("jalankan supabase/add_portal_progres_foto.sql di Supabase dulu.");
          throw new Error(`foto gagal diunggah (${error.message}).`);
        }
        paths.push(path);
      }
      await hasil(
        db().from("portal_progres_foto").insert(paths.map((path) => ({ proyek_id: item.proyek_id, item_id: itemId, path, dicatat_oleh: staf.id, ...(tahap ? { tahap } : {}) })))
      );
    } catch (e) {
      if (paths.length) await db().storage.from(BUCKET_PROGRES).remove(paths);
      if (/column .*tahap|'tahap' column/i.test(e.message || "")) throw new Error("kolom tahap belum ada. Jalankan supabase/add_portal_progres_foto_tahap.sql di Supabase dulu.");
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return gagal(e.message || "terjadi kesalahan.", 500);
  }
}
