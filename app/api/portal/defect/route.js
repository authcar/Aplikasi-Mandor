import { NextResponse } from "next/server";
import { db, hasil, UUID } from "@/lib/portal/db";
import { BUCKET_DEFECT, MAKS_FOTO_DEFECT, MAKS_KETERANGAN_DEFECT } from "@/lib/portal/defect";
import { hariIni } from "@/lib/portal/format";
import { sendPushToRoles } from "@/lib/push";

export const dynamic = "force-dynamic";

// Batas wajar supaya link yang bocor tidak bisa dipakai membanjiri data.
const MAKS_PER_HARI = 30;
const MAKS_BYTE_FOTO = 8 * 1024 * 1024; // foto sudah dikompres di HP (lib/gambar.js)

const gagal = (error, status = 400) => NextResponse.json({ error }, { status });

// POST /api/portal/defect — klien mengirim defect dari link /k/[token] (tanpa
// login). multipart: token, keterangan, item_id (opsional), foto (0..5 file).
// Tidak ikut kunci deadline: keluhan justru sering datang setelah serah terima.
export async function POST(req) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return gagal("data tidak terbaca. Coba kirim ulang dengan foto lebih sedikit.");
  }
  const token = String(form.get("token") || "");
  const keterangan = String(form.get("keterangan") || "").trim();
  const itemId = String(form.get("item_id") || "") || null;
  const foto = form.getAll("foto").filter((f) => f && typeof f === "object" && f.size > 0);

  if (!/^[\w-]{20,}$/.test(token)) return gagal("link tidak berlaku.", 404);
  if (!keterangan) return gagal("keterangan wajib diisi.");
  if (keterangan.length > MAKS_KETERANGAN_DEFECT) return gagal(`keterangan maksimal ${MAKS_KETERANGAN_DEFECT} huruf.`);
  if (foto.length > MAKS_FOTO_DEFECT) return gagal(`maksimal ${MAKS_FOTO_DEFECT} foto.`);
  if (foto.some((f) => !String(f.type).startsWith("image/"))) return gagal("lampiran harus berupa foto.");
  if (foto.some((f) => f.size > MAKS_BYTE_FOTO)) return gagal("ukuran foto terlalu besar.");

  try {
    const link = await hasil(db().from("portal_link").select("proyek_id, nama").eq("token", token).maybeSingle());
    if (!link) return gagal("link tidak berlaku.", 404);
    const proyek = await hasil(db().from("portal_proyek").select("id, nama").eq("id", link.proyek_id).maybeSingle());
    if (!proyek) return gagal("link tidak berlaku.", 404);

    if (itemId) {
      if (!UUID.test(itemId)) return gagal("item tidak valid.");
      const it = await hasil(db().from("portal_item").select("proyek_id").eq("id", itemId).maybeSingle());
      if (it?.proyek_id !== proyek.id) return gagal("item tidak valid.");
    }

    const { count } = await db()
      .from("portal_defect")
      .select("id", { count: "exact", head: true })
      .eq("proyek_id", proyek.id)
      .gte("created_at", `${hariIni()}T00:00:00+07:00`);
    if (count >= MAKS_PER_HARI) return gagal("sudah banyak laporan hari ini. Silakan hubungi tim Taraco langsung.", 429);

    // Unggah foto dulu; kalau penyimpanan data gagal, foto yang sudah naik dihapus lagi.
    const paths = [];
    try {
      for (let i = 0; i < foto.length; i++) {
        const f = foto[i];
        const ext = (String(f.name).split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${proyek.id}/${Date.now()}-${i}.${ext}`;
        const { error } = await db().storage.from(BUCKET_DEFECT).upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
        if (error) throw new Error(`foto gagal diunggah (${error.message}).`);
        paths.push(path);
      }
      await hasil(
        db().from("portal_defect").insert({ proyek_id: proyek.id, item_id: itemId, keterangan, pelapor: link.nama || null, foto: paths })
      );
    } catch (e) {
      if (paths.length) await db().storage.from(BUCKET_DEFECT).remove(paths);
      throw e;
    }

    // Pemberitahuan ke admin & supervisor; gagal di sini tidak membatalkan laporan.
    await sendPushToRoles(["MASTER", "FINANCE", "SUPERVISOR"], {
      title: `Defect baru · ${proyek.nama}`,
      body: `${link.nama ? `${link.nama}: ` : ""}${keterangan.slice(0, 120)}`,
      url: `/portal/proyek/${proyek.id}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (/could not find the table|does not exist|bucket not found/i.test(e.message || ""))
      return gagal("fitur defect belum aktif. Hubungi tim Taraco.", 503);
    return gagal(e.message || "terjadi kesalahan.", 500);
  }
}
