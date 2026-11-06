import { NextResponse } from "next/server";
import { db, hasil } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilItem, ambilProyek } from "@/lib/portal/data";
import { ambilRiwayat } from "@/lib/portal/riwayat";
import { ambilFotoProgres } from "@/lib/portal/progresFoto";
import { hariIni } from "@/lib/portal/format";
import { daftarMinggu, hitungMinggu, indeksRiwayat } from "@/lib/portal/mingguan";
import { tahapItem } from "@/lib/portal/progresBoq";
import { buatPdfLaporanMingguan } from "@/lib/portal/mingguanPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAKS_FOTO = 12; // foto per PDF
const MAKS_BYTE_FOTO = 1.5 * 1024 * 1024; // per foto
const MAKS_BYTE_TOTAL = 3.2 * 1024 * 1024; // total foto (batas respons serverless ~4,5 MB)
const tglJakarta = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

// GET /api/portal/laporan-mingguan/pdf?proyek_id=...&minggu=N
// PDF laporan mingguan satu proyek tracker: progres sebelum/sesudah, tahap yang
// dikerjakan, item yang bergerak, dan foto progres minggu itu. Admin (MASTER/FINANCE)
// dan supervisor; tidak memuat nilai rupiah.
export async function GET(req) {
  const { staf } = await ambilStaf();
  if (!staf || staf.role === "TUKANG") return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const proyekId = searchParams.get("proyek_id");
  const no = Number(searchParams.get("minggu"));
  if (!proyekId || !Number.isInteger(no) || no < 1)
    return NextResponse.json({ error: "proyek_id dan minggu wajib diisi." }, { status: 400 });

  try {
    const proyek = await ambilProyek(proyekId);
    if (!bolehProyek(staf, proyek)) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

    const hari = hariIni();
    const [items, riwayat, fotoSemua, logo, spv] = await Promise.all([
      ambilItem([proyek]),
      ambilRiwayat(proyek.id),
      ambilFotoProgres(proyek.id).catch(() => []),
      fetch(new URL("/logo.png", req.url))
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => (b ? new Uint8Array(b) : null))
        .catch(() => null),
      proyek.supervisor_id
        ? hasil(db().from("profiles").select("name").eq("id", proyek.supervisor_id).maybeSingle()).catch(() => null)
        : null,
    ]);

    const minggu = daftarMinggu(proyek, items, riwayat, hari).find((m) => m.no === no);
    if (!minggu) return NextResponse.json({ error: "Minggu tidak ditemukan." }, { status: 404 });
    const h = hitungMinggu(items, indeksRiwayat(riwayat), minggu, hari);

    // Item yang progresnya berubah (naik atau dikoreksi turun), per area lalu nama.
    const item = h.tim
      .flatMap((t) => t.item.map((i) => ({ ...i, tim: t.tim === "Belum ada tim" ? "" : t.tim })))
      .filter((i) => Math.abs(i.naik) > 0.005)
      .sort((a, b) => String(a.area).localeCompare(String(b.area)) || String(a.nama).localeCompare(String(b.nama)));

    // Foto progres yang diunggah pada minggu itu (maks MAKS_FOTO terbaru), diunduh
    // satu per satu dengan batas ukuran supaya respons tidak kebesaran.
    const dalamMinggu = fotoSemua.filter((f) => {
      const t = tglJakarta(f.created_at);
      return t >= minggu.mulai && t <= minggu.akhir;
    });
    const dipilih = dalamMinggu.slice(-MAKS_FOTO);
    const infoItem = new Map(items.map((i) => [i.id, i]));
    const foto = [];
    let total = 0;
    for (const f of dipilih) {
      const it = infoItem.get(f.item_id);
      const tahap = it ? tahapItem(it).find((s) => s.k === f.tahap)?.label : null;
      const keterangan = [it?.nama || "Item", tahap].filter(Boolean).join(" - ");
      let data = null;
      try {
        const res = await fetch(f.url);
        const buf = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
        if (buf && buf.length <= MAKS_BYTE_FOTO && total + buf.length <= MAKS_BYTE_TOTAL) {
          data = buf;
          total += buf.length;
        }
      } catch {}
      foto.push({ data, keterangan });
    }

    const namaProyek = proyek.nama || "Proyek";
    const pdf = buatPdfLaporanMingguan({
      proyek: namaProyek,
      lokasi: proyek.lokasi || null,
      spk: proyek.kode || null,
      client: proyek.klien_nama || null,
      supervisor: spv?.name || (staf.role === "SUPERVISOR" ? staf.nama : null),
      minggu,
      hasil: h,
      item,
      foto,
      fotoLebih: dalamMinggu.length - dipilih.length,
      logo,
    });

    const namaFile = `Laporan Mingguan - ${namaProyek} - Minggu ${no}.pdf`.replace(/[^\w .()-]/g, "").replace(/\s+/g, " ");
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${namaFile}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("portal/laporan-mingguan/pdf gagal:", e?.message);
    return NextResponse.json({ error: "Gagal membuat PDF." }, { status: 500 });
  }
}
