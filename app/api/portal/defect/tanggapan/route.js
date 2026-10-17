import { NextResponse } from "next/server";
import { db, hasil, UUID } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilProyek } from "@/lib/portal/data";
import { BUCKET_DEFECT, MAKS_FOTO_DEFECT } from "@/lib/portal/defect";

export const dynamic = "force-dynamic";

const MAKS_BYTE_FOTO = 8 * 1024 * 1024; // foto sudah dikompres di browser (lib/gambar.js)
const gagal = (error, status = 400) => NextResponse.json({ error }, { status });

// POST /api/portal/defect/tanggapan — admin/supervisor menambah foto ke
// tanggapan satu defect (mis. foto sesudah diperbaiki). multipart: id, foto (1..5).
// Lewat route (bukan server action) karena batas ukuran server action 1 MB.
// Tidak ikut kunci deadline, sama seperti defect-nya.
export async function POST(req) {
  const { staf } = await ambilStaf();
  if (!staf || staf.role === "TUKANG") return gagal("tidak punya akses.", 403);

  let form;
  try {
    form = await req.formData();
  } catch {
    return gagal("data tidak terbaca. Coba kirim ulang dengan foto lebih sedikit.");
  }
  const id = String(form.get("id") || "");
  const foto = form.getAll("foto").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!UUID.test(id)) return gagal("defect tidak valid.");
  if (!foto.length) return gagal("pilih fotonya dulu.");
  if (foto.some((f) => !String(f.type).startsWith("image/"))) return gagal("lampiran harus berupa foto.");
  if (foto.some((f) => f.size > MAKS_BYTE_FOTO)) return gagal("ukuran foto terlalu besar.");

  try {
    const d = await hasil(db().from("portal_defect").select("*").eq("id", id).maybeSingle());
    if (!d) return gagal("defect tidak ditemukan.", 404);
    if (!bolehProyek(staf, await ambilProyek(d.proyek_id))) return gagal("tidak punya akses ke proyek ini.", 403);
    if (d.checklist_id) return gagal("defect ini dikelola di Defect List Aplikasi Mandor.");
    if (!("foto_tanggapan" in d))
      return gagal("kolom foto tanggapan belum ada. Jalankan supabase/add_portal_defect_foto_tanggapan.sql di Supabase dulu.", 503);
    const lama = d.foto_tanggapan || [];
    if (lama.length + foto.length > MAKS_FOTO_DEFECT)
      return gagal(`foto tanggapan maksimal ${MAKS_FOTO_DEFECT} (sudah ada ${lama.length}).`);

    const paths = [];
    try {
      for (let i = 0; i < foto.length; i++) {
        const f = foto[i];
        const ext = (String(f.name).split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${d.proyek_id}/t-${Date.now()}-${i}.${ext}`;
        const { error } = await db().storage.from(BUCKET_DEFECT).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
        if (error) throw new Error(`foto gagal diunggah (${error.message}).`);
        paths.push(path);
      }
      await hasil(
        db().from("portal_defect")
          .update({ foto_tanggapan: [...lama, ...paths], diubah_oleh: staf.id, diubah_at: new Date().toISOString() })
          .eq("id", id)
      );
    } catch (e) {
      if (paths.length) await db().storage.from(BUCKET_DEFECT).remove(paths);
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return gagal(e.message || "terjadi kesalahan.", 500);
  }
}
