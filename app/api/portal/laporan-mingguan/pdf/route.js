import { NextResponse } from "next/server";
import { db, hasil } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilItem, ambilProyek } from "@/lib/portal/data";
import { ambilRiwayat } from "@/lib/portal/riwayat";
import { ambilFotoProgres } from "@/lib/portal/progresFoto";
import { hariIni } from "@/lib/portal/format";
import { daftarMinggu, hitungMinggu, indeksRiwayat, keadaanSampai } from "@/lib/portal/mingguan";
import { tahapItem, tahapBerikut, itemProgres, tanpaRetensi } from "@/lib/portal/progresBoq";
import { buatPdfLaporanMingguan } from "@/lib/portal/mingguanPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAKS_FOTO = 40; // foto per PDF
const MAKS_BYTE_ASAL = 12 * 1024 * 1024; // foto asli yang lebih besar dari ini dilewati
const MAKS_BYTE_TOTAL = 3.4 * 1024 * 1024; // total foto setelah dikompres (batas respons serverless ~4,5 MB)
const SISI_FOTO = 800; // px, sisi terpanjang; di PDF foto hanya tampil ±9 x 7 cm
const MUTU_FOTO = 70;
const SERENTAK = 6; // unduh + kompres paralel

// Foto diperkecil dan diputar sesuai EXIF, hasilnya JPEG ±60-80 KB. null = gagal.
async function kecilkan(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const asal = Buffer.from(await res.arrayBuffer());
    if (asal.length > MAKS_BYTE_ASAL) return null;
    const { default: sharp } = await import("sharp");
    const hasilJpeg = await sharp(asal)
      .rotate()
      .resize(SISI_FOTO, SISI_FOTO, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: MUTU_FOTO, mozjpeg: true })
      .toBuffer();
    return new Uint8Array(hasilJpeg);
  } catch {
    return null;
  }
}
const tglJakarta = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

// GET /api/portal/laporan-mingguan/pdf?proyek_id=...&minggu=N[&untuk=klien]
// Versi internal (default) menghitung retensi. Versi klien (untuk=klien) tanpa retensi:
// begitu instalasi selesai, progres item langsung 100%.
// PDF laporan mingguan satu proyek tracker: progres sebelum/sesudah, tahap yang
// dikerjakan, item yang bergerak, dan foto progres minggu itu. Admin (MASTER/FINANCE)
// dan supervisor; tidak memuat nilai rupiah.
export async function GET(req) {
  const { staf } = await ambilStaf();
  if (!staf || staf.role === "TUKANG") return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const proyekId = searchParams.get("proyek_id");
  const no = Number(searchParams.get("minggu"));
  const untukKlien = searchParams.get("untuk") === "klien";
  if (!proyekId || !Number.isInteger(no) || no < 1)
    return NextResponse.json({ error: "proyek_id dan minggu wajib diisi." }, { status: 400 });

  try {
    const proyek = await ambilProyek(proyekId);
    if (!bolehProyek(staf, proyek)) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

    const hari = hariIni();
    const [itemsAsli, riwayat, fotoSemua, logo, spv] = await Promise.all([
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

    const items = untukKlien ? itemsAsli.map(tanpaRetensi) : itemsAsli;
    const minggu = daftarMinggu(proyek, items, riwayat, hari).find((m) => m.no === no);
    if (!minggu) return NextResponse.json({ error: "Minggu tidak ditemukan." }, { status: 404 });
    const h = hitungMinggu(items, indeksRiwayat(riwayat), minggu, hari);

    // Semua item yang ikut hitungan progres (termasuk yang masih 0%), sesuai urutan
    // di BoQ; PDF mengelompokkannya per area seperti contoh laporan.
    const hitung = new Map(h.tim.flatMap((t) => t.item.map((i) => [i.id, i])));
    // Catatan per item = caption foto progres yang diunggah pada minggu itu (urut lama -> baru,
    // tanpa duplikat). Item tanpa caption minggu itu memakai catatan otomatis di PDF (naik/turun).
    const captionMinggu = new Map(); // item_id -> [caption]
    for (const f of fotoSemua) {
      const cap = String(f.caption || "").trim();
      const tgl = tglJakarta(f.created_at);
      if (!cap || tgl < minggu.mulai || tgl > minggu.akhir) continue;
      const daftar = captionMinggu.get(f.item_id) || [];
      if (!daftar.includes(cap)) daftar.push(cap);
      captionMinggu.set(f.item_id, daftar);
    }
    const item = items
      .filter((i) => hitung.has(i.id))
      .map((i) => ({ ...hitung.get(i.id), kode: i.kode || "", catatan: (captionMinggu.get(i.id) || []).join("; ") }));

    // Rencana pekerjaan selanjutnya: tahap berikut dari tiap item yang belum selesai
    // pada akhir minggu itu, urutan BoQ. Tahap retensi bukan pekerjaan, jadi dilewati.
    const sampai = minggu.akhir > hari ? hari : minggu.akhir;
    const idx = indeksRiwayat(riwayat);
    const rencana = [];
    for (const i of items.filter(itemProgres)) {
      const s = tahapBerikut(keadaanSampai(i, idx, sampai));
      if (s && s.fase !== "retensi") rencana.push({ nama: i.nama, kode: i.kode || "", tahap: s.label });
    }

    // Dokumentasi: foto progres TERAKHIR tiap item BoQ (sampai akhir minggu itu), urutan
    // BoQ. Item tanpa foto tidak ikut. Diunduh dengan batas ukuran supaya respons tidak kebesaran.
    const terakhir = new Map(); // item_id -> foto terbaru (fotoSemua urut lama -> baru)
    for (const f of fotoSemua) if (tglJakarta(f.created_at) <= minggu.akhir) terakhir.set(f.item_id, f);
    const dalamMinggu = items.filter((i) => itemProgres(i) && terakhir.has(i.id)).map((i) => terakhir.get(i.id));
    const dipilih = dalamMinggu.slice(0, MAKS_FOTO);
    const infoItem = new Map(items.map((i) => [i.id, i]));
    // Diunduh dan dikompres per kelompok (SERENTAK foto) supaya cepat tapi memori tetap terkendali.
    const kecil = [];
    for (let n = 0; n < dipilih.length; n += SERENTAK)
      kecil.push(...(await Promise.all(dipilih.slice(n, n + SERENTAK).map((f) => kecilkan(f.url)))));
    const foto = [];
    let total = 0;
    let terbuang = 0; // foto yang tidak muat di batas total
    dipilih.forEach((f, i) => {
      const it = infoItem.get(f.item_id);
      const tahap = it ? tahapItem(it).find((s) => s.k === f.tahap)?.label : null;
      // Caption yang ditulis staf dipakai apa adanya; tanpa caption: nama item - tahap.
      const keterangan = f.caption || [it?.nama || "Item", tahap].filter(Boolean).join(" - ");
      let data = kecil[i];
      if (data && total + data.length > MAKS_BYTE_TOTAL) {
        data = null;
        terbuang++;
      } else if (data) total += data.length;
      foto.push({ data, keterangan });
    });

    const namaProyek = proyek.nama || "Proyek";
    const pdf = buatPdfLaporanMingguan({
      proyek: namaProyek,
      lokasi: proyek.lokasi || null,
      supervisor: spv?.name || (staf.role === "SUPERVISOR" ? staf.nama : null),
      minggu,
      hasil: h,
      item,
      rencana,
      foto,
      fotoLebih: dalamMinggu.length - dipilih.length + terbuang,
      logo,
    });

    const namaFile = `Laporan Mingguan - ${namaProyek} - Minggu ${no}${untukKlien ? " (Klien)" : ""}.pdf`.replace(/[^\w .()-]/g, "").replace(/\s+/g, " ");
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
