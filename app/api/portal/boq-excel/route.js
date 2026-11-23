import { NextResponse } from "next/server";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilItem, ambilProyek } from "@/lib/portal/data";
import { UUID } from "@/lib/portal/db";
import { buatXlsxBoq } from "@/lib/portal/boqXlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/portal/boq-excel?proyek_id=...
// Unduh daftar BoQ satu proyek sebagai file Excel (dibuat dari item di portal, urutan BoQ).
// Admin (MASTER/FINANCE) dan supervisor proyeknya; kolom harga jasa hanya untuk admin.
export async function GET(req) {
  const { staf } = await ambilStaf();
  if (!staf || staf.role === "TUKANG") return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const proyekId = new URL(req.url).searchParams.get("proyek_id") || "";
  if (!UUID.test(proyekId)) return NextResponse.json({ error: "proyek_id tidak valid." }, { status: 400 });

  try {
    const proyek = await ambilProyek(proyekId);
    if (!bolehProyek(staf, proyek)) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });
    const items = await ambilItem([proyek]);
    const xlsx = buatXlsxBoq({ proyek: proyek.nama, lokasi: proyek.lokasi, kode: proyek.kode, items, denganHarga: staf.role === "ADMIN" });
    const nama = `BoQ - ${proyek.nama || "Proyek"}.xlsx`.replace(/[^\w .()-]/g, "").replace(/\s+/g, " ");
    return new Response(xlsx, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nama}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("portal/boq-excel gagal:", e?.message);
    return NextResponse.json({ error: "Gagal membuat file Excel." }, { status: 500 });
  }
}
