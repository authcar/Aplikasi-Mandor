import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, UUID } from "@/lib/portal/db";
import { ambilStaf } from "@/lib/portal/server";
import { ambilProyek } from "@/lib/portal/data";
import { BUCKET_BOQ, hapusFileBoq } from "@/lib/portal/boqFile";

export const dynamic = "force-dynamic";

const gagal = (error, status = 400) => NextResponse.json({ error }, { status });
const SQL = "jalankan supabase/add_portal_boq_file.sql di Supabase dulu.";
const namaAman = (s) => String(s || "BoQ.xlsx").replace(/[^\w .()-]/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "BoQ.xlsx";

// File BoQ asli bisa memuat harga, jadi hanya admin (MASTER/FINANCE).
//   POST { aksi: "url", proyek_id, nama }          -> { path, token }  izin unggah langsung ke storage
//        (file BoQ berisi foto bisa >4,5 MB, melebihi batas body route, jadi browser mengunggah sendiri)
//   POST { aksi: "simpan", proyek_id, path, nama } -> { ok }           mencatat file di proyek, file lama dihapus
//   GET  ?proyek_id=...                             -> { url, nama }    tautan unduh sementara
export async function POST(req) {
  const { staf } = await ambilStaf();
  if (staf?.role !== "ADMIN") return gagal("hanya admin.", 403);
  const b = await req.json().catch(() => null);
  if (!b || !UUID.test(b.proyek_id || "")) return gagal("proyek tidak valid.");
  const proyek = await ambilProyek(b.proyek_id);
  if (!proyek) return gagal("proyek tidak ditemukan.", 404);

  try {
    if (b.aksi === "url") {
      const nama = namaAman(b.nama);
      if (!/\.xlsx$/i.test(nama)) return gagal("file harus berformat .xlsx.");
      const path = `${proyek.id}/${Date.now()}-${randomBytes(4).toString("hex")}.xlsx`;
      const { data, error } = await db().storage.from(BUCKET_BOQ).createSignedUploadUrl(path);
      if (error) {
        const belum = /bucket not found/i.test(error.message);
        return gagal(belum ? SQL : error.message, belum ? 503 : 500);
      }
      return NextResponse.json({ path, token: data.token });
    }
    if (b.aksi === "simpan") {
      const path = String(b.path || "");
      if (!path.startsWith(`${proyek.id}/`) || path.includes("..")) return gagal("path tidak valid.");
      const lama = proyek.boq_file;
      const { error } = await db()
        .from("portal_proyek")
        .update({ boq_file: path, boq_file_nama: namaAman(b.nama), boq_file_at: new Date().toISOString() })
        .eq("id", proyek.id);
      if (error) {
        const belum = /boq_file/i.test(error.message);
        return gagal(belum ? SQL : error.message, belum ? 503 : 500);
      }
      if (lama && lama !== path) await hapusFileBoq([lama]);
      return NextResponse.json({ ok: true });
    }
    return gagal("aksi tidak dikenal.");
  } catch (e) {
    console.error("portal/boq-file gagal:", e?.message);
    return gagal("Gagal menyimpan file BoQ.", 500);
  }
}

export async function GET(req) {
  const { staf } = await ambilStaf();
  if (staf?.role !== "ADMIN") return gagal("hanya admin.", 403);
  const id = new URL(req.url).searchParams.get("proyek_id") || "";
  if (!UUID.test(id)) return gagal("proyek tidak valid.");
  const proyek = await ambilProyek(id);
  if (!proyek) return gagal("proyek tidak ditemukan.", 404);
  if (!proyek.boq_file) return gagal("file BoQ asli belum tersimpan.", 404);
  const { data, error } = await db().storage.from(BUCKET_BOQ).createSignedUrl(proyek.boq_file, 300, { download: proyek.boq_file_nama || "BoQ.xlsx" });
  if (error || !data?.signedUrl) return gagal("file tidak ditemukan di penyimpanan.", 404);
  return NextResponse.json({ url: data.signedUrl, nama: proyek.boq_file_nama });
}
