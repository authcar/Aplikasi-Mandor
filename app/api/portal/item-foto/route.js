import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, UUID } from "@/lib/portal/db";
import { ambilStaf } from "@/lib/portal/server";
import { ambilProyek } from "@/lib/portal/data";
import { BUCKET_ITEM } from "@/lib/portal/fotoItem";

export const dynamic = "force-dynamic";

const MAKS_BYTE = 4 * 1024 * 1024; // foto sudah dikecilkan di browser (lib/gambar.js)
const gagal = (error, status = 400) => NextResponse.json({ error }, { status });

// POST /api/portal/item-foto — admin mengunggah satu foto item saat impor BOQ.
// multipart: proyek_id, foto. Balasan { path } untuk disimpan di portal_item.foto.
// Lewat route (bukan server action) karena batas ukuran server action 1 MB.
export async function POST(req) {
  const { staf } = await ambilStaf();
  if (staf?.role !== "ADMIN") return gagal("hanya admin.", 403);
  let form;
  try {
    form = await req.formData();
  } catch {
    return gagal("data tidak terbaca.");
  }
  const proyekId = String(form.get("proyek_id") || "");
  const foto = form.get("foto");
  if (!UUID.test(proyekId)) return gagal("proyek tidak valid.");
  if (!foto || typeof foto !== "object" || !(foto.size > 0)) return gagal("pilih fotonya dulu.");
  if (!String(foto.type).startsWith("image/")) return gagal("lampiran harus berupa foto.");
  if (foto.size > MAKS_BYTE) return gagal("ukuran foto terlalu besar.");
  if (!(await ambilProyek(proyekId))) return gagal("proyek tidak ditemukan.", 404);

  const ext = foto.type === "image/png" ? "png" : "jpg";
  const path = `${proyekId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const { error } = await db().storage.from(BUCKET_ITEM).upload(path, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type });
  if (error) {
    if (/bucket not found/i.test(error.message)) return gagal("jalankan supabase/add_portal_item_foto.sql di Supabase dulu.", 503);
    return gagal(`foto gagal diunggah (${error.message}).`, 500);
  }
  return NextResponse.json({ path });
}
