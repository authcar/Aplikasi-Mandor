import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, UUID } from "@/lib/portal/db";
import { ambilProyek } from "@/lib/portal/data";
import { BUCKET_ITEM } from "@/lib/portal/fotoItem";
import { tambahItemProyek, gantiItemProyek } from "@/lib/portal/itemProyek";
import { anggotaDariToken, pastikanProyekTaraco, dorongProgres } from "@/lib/portal/tautTaraco";

export const dynamic = "force-dynamic";

// Impor BoQ dari website Taraco Project Management. Website itu hanya punya
// session Supabase Taraco, jadi pemanggilnya dikenali lewat access token-nya
// (Authorization: Bearer ...), bukan cookie; hanya MASTER / SALES Taraco yang aktif.
//
//   POST application/json  { aksi: "siapkan", taraco_id }
//        -> { proyek_id, baru, nama, jumlah_item }   proyek tracker dibuat / ditautkan
//   POST multipart         proyek_id, foto
//        -> { path }                                 satu foto item (gambar kolom C)
//   POST application/json  { aksi: "simpan", proyek_id, items, mode: "tambah" | "ganti" }
//        -> { ok, jumlah }                           item disimpan, progres didorong ke Taraco
//
// Bearer token (bukan cookie) -> CORS "*" tidak membuka celah CSRF.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const balas = (data, status = 200) => NextResponse.json(data, { status, headers: CORS });
const gagal = (error, status = 400) => balas({ error }, status);

const MAKS_BYTE = 4 * 1024 * 1024; // foto sudah dikecilkan di browser
const MAKS_ITEM = 2000;

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });

// Proyek tracker yang boleh diisi lewat jalur ini: harus tertaut ke proyek Taraco.
async function proyekTertaut(id) {
  if (!UUID.test(id || "")) return null;
  const p = await ambilProyek(id);
  return p?.taraco_id ? p : null;
}

export async function POST(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let anggota;
  try {
    anggota = await anggotaDariToken(token);
  } catch {
    return gagal("tidak bisa memeriksa akun Taraco.", 503);
  }
  if (!anggota) return gagal("hanya Master / Sales Taraco yang boleh mengunggah BoQ.", 403);

  try {
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const proyekId = String(form.get("proyek_id") || "");
      const foto = form.get("foto");
      if (!(await proyekTertaut(proyekId))) return gagal("proyek tidak ditemukan.", 404);
      if (!foto || typeof foto !== "object" || !(foto.size > 0)) return gagal("pilih fotonya dulu.");
      if (!String(foto.type).startsWith("image/")) return gagal("lampiran harus berupa foto.");
      if (foto.size > MAKS_BYTE) return gagal("ukuran foto terlalu besar.");
      const ext = foto.type === "image/png" ? "png" : "jpg";
      const path = `${proyekId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
      const { error } = await db().storage.from(BUCKET_ITEM).upload(path, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type });
      if (error) {
        if (/bucket not found/i.test(error.message)) return gagal("jalankan supabase/add_portal_item_foto.sql di Supabase dulu.", 503);
        return gagal(`foto gagal diunggah (${error.message}).`, 500);
      }
      return balas({ path });
    }

    const b = await req.json().catch(() => null);
    if (!b) return gagal("data tidak terbaca.");

    if (b.aksi === "siapkan") {
      if (!UUID.test(b.taraco_id || "")) return gagal("proyek tidak valid.");
      const p = await pastikanProyekTaraco(b.taraco_id);
      return balas({ proyek_id: p.id, baru: p.baru, nama: p.nama, jumlah_item: p.jumlahItem });
    }

    if (b.aksi === "simpan") {
      if (!(await proyekTertaut(b.proyek_id))) return gagal("proyek tidak ditemukan.", 404);
      if (!Array.isArray(b.items) || !b.items.length) return gagal("tidak ada item untuk disimpan.");
      if (b.items.length > MAKS_ITEM) return gagal(`terlalu banyak item (maksimal ${MAKS_ITEM}).`);
      const items = b.items.filter((i) => i && typeof i === "object");
      if (b.mode === "ganti") await gantiItemProyek(b.proyek_id, items);
      else await tambahItemProyek(b.proyek_id, items);
      await dorongProgres(b.proyek_id);
      return balas({ ok: true, jumlah: items.length });
    }

    return gagal("aksi tidak dikenal.");
  } catch (e) {
    if (/could not find the '\w+' column|column .* does not exist/i.test(e.message || ""))
      return gagal("kolom di database belum lengkap: jalankan file SQL add_portal_*.sql di Supabase dulu.", 503);
    return gagal(e.message || "Terjadi kesalahan.", 500);
  }
}
