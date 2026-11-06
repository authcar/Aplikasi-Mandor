import { jsPDF } from "jspdf";
import { bersih, formatGambar } from "../laporanHarianPdf.js";

// PDF laporan mingguan satu proyek tracker (Portal Klien). Formatnya mengikuti
// contoh "Progres Report LKT Karawang - Week 9" (A4): logo + tulisan REPORT,
// "WEEKLY REPORT", tabel identitas proyek, tabel progres / pekerjaan minggu ini,
// tabel progres per item (dikelompokkan per area), lalu DOKUMENTASI foto 2 kolom.
// Tidak memuat nilai rupiah, jadi aman untuk supervisor. Satuan milimeter.

const L = 17; // margin kiri
const W = 176; // lebar tabel
const R = L + W;
const BAWAH = 282; // batas bawah konten
const GARIS = 0.35;
const MAKS_PEKERJAAN = 20; // baris "pekerjaan minggu ini" sebelum diringkas

// Persen ringkas: 95 -> "95%", 12,5 -> "12,5%".
const ringkas = (n) => `${String(Math.round(n * 10) / 10).replace(".", ",")}%`;
const huruf = (i) => (i >= 26 ? huruf(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

// data: {
//   proyek, lokasi, supervisor, minggu: { no, mulai, akhir, berjalan },
//   hasil: { sebelum, sesudah, naik, tahap: [{ label, poin, bagian }] },
//   item: [{ area, nama, kode, sebelum, sesudah, naik }],   // urutan tampil
//   foto: [{ data: Uint8Array | null, keterangan }], fotoLebih: jumlah foto yang tidak dimuat,
//   logo: Uint8Array | null
// }
// Return ArrayBuffer siap dikirim sebagai response.
export function buatPdfLaporanMingguan(data) {
  const { proyek, lokasi, supervisor, minggu, hasil, item, foto = [], fotoLebih = 0, logo } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setLineWidth(GARIS).setDrawColor(0, 0, 0);

  const kotak = (x, y, w, h) => doc.rect(x, y, w, h, "S");
  const teks = (str, x, y, o = {}) => {
    doc
      .setFont("helvetica", o.tebal ? "bold" : "normal")
      .setFontSize(o.ukuran || 8.5)
      .setTextColor(...(o.warna || [0, 0, 0]));
    doc.text(str, x, y, { align: o.rata || "left", baseline: "middle" });
  };
  const tengah = (str, x, y, w, h, o = {}) => teks(str, x + w / 2, y + h / 2, { ...o, rata: "center" });
  // Teks (boleh beberapa baris) di tengah-vertikal sebuah sel, rata kiri.
  const sel = (baris, x, y, w, h, o = {}) => {
    const lh = (o.ukuran || 8.5) * 0.42;
    const atas = y + h / 2 - ((baris.length - 1) * lh) / 2;
    baris.forEach((b, j) => teks(b, x + 2, atas + j * lh, o));
  };
  const bungkus = (str, w, ukuran = 8.5, maks = 4) =>
    doc.setFont("helvetica", "normal").setFontSize(ukuran).splitTextToSize(bersih(str) || "-", w - 4).slice(0, maks);

  // ---------- Kop ----------
  const fmtLogo = formatGambar(logo);
  if (fmtLogo) {
    try {
      const p = doc.getImageProperties(logo);
      const lw = 57;
      doc.addImage(logo, fmtLogo, L, 17, lw, (lw * p.height) / p.width, undefined, "FAST");
    } catch {}
  }
  teks("REPORT", R, 25, { ukuran: 32, warna: [150, 150, 150], rata: "right" });
  tengah("WEEKLY REPORT", L, 42, W, 6, { tebal: true, ukuran: 10.5 });

  // ---------- Identitas ----------
  let y = 53;
  const k = [20.5, 71, 29.4, 13.5, 29.6, 11.9]; // PROJECT | nama | MINGGU KE- | no | PERSENTASE | %
  const x = k.reduce((a, w, i) => [...a, (a[i] || L) + w], [L]);
  const h1 = 7.9;
  const bLokasi = bungkus(lokasi, k[1], 7.5, 3);
  const h2 = Math.max(h1 + 2, bLokasi.length * 3.2 + 4);
  const bProyek = bungkus(proyek, k[1], 7.5, 2);
  const hBaris1 = Math.max(h1, bProyek.length * 3.2 + 3);
  [0, 1, 2, 3, 4, 5].forEach((i) => kotak(x[i], y, k[i], hBaris1));
  sel(["PROJECT"], x[0], y, k[0], hBaris1, { ukuran: 7.5 });
  sel(bProyek, x[1], y, k[1], hBaris1, { ukuran: 7.5 });
  sel(["MINGGU KE-"], x[2], y, k[2], hBaris1, { ukuran: 7.5 });
  tengah(String(minggu.no), x[3], y, k[3], hBaris1, { ukuran: 8.5 });
  sel(["PERSENTASE"], x[4], y, k[4], hBaris1, { ukuran: 8 });
  tengah(`${Math.round(hasil.sesudah)} %`, x[5], y, k[5], hBaris1, { ukuran: 8 });
  y += hBaris1;
  kotak(x[0], y, k[0], h2);
  kotak(x[1], y, k[1], h2);
  kotak(x[2], y, k[2], h2);
  kotak(x[3], y, k[3] + k[4] + k[5], h2);
  sel(["LOKASI"], x[0], y, k[0], h2, { ukuran: 7.5 });
  sel(bLokasi, x[1], y, k[1], h2, { ukuran: 7.5 });
  sel(["PENGAWAS"], x[2], y, k[2], h2, { ukuran: 7.5 });
  sel([bersih(supervisor) || "-"], x[3], y, k[3] + k[4] + k[5], h2, { ukuran: 8.5 });
  y += h2 + 10;

  const halamanBaru = () => {
    doc.addPage();
    doc.setLineWidth(GARIS).setDrawColor(0, 0, 0);
    y = 16;
  };
  const muat = (h) => {
    if (y + h > BAWAH) halamanBaru();
  };

  // ---------- Progres pekerjaan / pekerjaan minggu ini ----------
  const kP = [10.4, 81, 84.6];
  const xP = [L, L + kP[0], L + kP[0] + kP[1]];
  const hHead = 8.2;
  kotak(xP[0], y, kP[0], hHead);
  kotak(xP[1], y, kP[1], hHead);
  kotak(xP[2], y, kP[2], hHead);
  tengah("NO", xP[0], y, kP[0], hHead, { tebal: true, ukuran: 8 });
  tengah("PROGRES PEKERJAAN", xP[1], y, kP[1], hHead, { tebal: true, ukuran: 8 });
  tengah("PEKERJAAN MINGGU INI", xP[2], y, kP[2], hHead, { tebal: true, ukuran: 8 });
  y += hHead;

  const kiri = [`Sebelumnya ${ringkas(hasil.sebelum)}`, ...hasil.tahap.map((t) => `${t.label} (+${ringkas(t.poin)})`)];
  const berubah = item.filter((i) => Math.abs(i.naik) > 0.005);
  const kanan = berubah.slice(0, MAKS_PEKERJAAN).map((i) => `${i.nama}${i.kode ? ` (${i.kode})` : ""} ${i.naik > 0 ? "+" : ""}${ringkas(i.naik)}`);
  if (berubah.length > MAKS_PEKERJAAN) kanan.push(`+ ${berubah.length - MAKS_PEKERJAAN} item lainnya`);
  if (!kanan.length) kanan.push("Tidak ada perubahan progres minggu ini");
  const nBaris = Math.max(kiri.length, kanan.length, 5);
  for (let r = 0; r < nBaris; r++) {
    const bl = kiri[r] ? bungkus(kiri[r], kP[1], 8, 3) : [];
    const br = kanan[r] ? bungkus(kanan[r], kP[2], 8, 3) : [];
    const h = Math.max(7, Math.max(bl.length, br.length) * 3.4 + 3);
    muat(h);
    kotak(xP[0], y, kP[0], h);
    kotak(xP[1], y, kP[1], h);
    kotak(xP[2], y, kP[2], h);
    if (kiri[r] || kanan[r]) teks(String(r + 1), xP[0] + 1.5, y + 3.2, { ukuran: 8 });
    sel(bl, xP[1], y, kP[1], h, { ukuran: 8 });
    sel(br, xP[2], y, kP[2], h, { ukuran: 8 });
    y += h;
  }
  y += 12;

  // ---------- Progres per item ----------
  const kI = [10.4, 52.8, 35, 77.8];
  const xI = [L, L + kI[0], L + kI[0] + kI[1], L + kI[0] + kI[1] + kI[2]];
  const baris4 = (h) => kI.forEach((w, i) => kotak(xI[i], y, w, h));
  muat(8.6 + 8);
  baris4(8.6);
  ["NO", "NAMA ITEM", "PROGRES (%)", "CATATAN"].forEach((t, i) => tengah(t, xI[i], y, kI[i], 8.6, { tebal: true, ukuran: 8 }));
  y += 8.6;

  // Kelompok per area, urutan kemunculan pertama.
  const area = [];
  for (const it of item) {
    const nama = String(it.area || "").trim() || "Lainnya";
    let g = area.find((a) => a.nama === nama);
    if (!g) area.push((g = { nama, item: [] }));
    g.item.push(it);
  }
  if (!area.length) {
    baris4(7.9);
    tengah("Belum ada item.", L, y, W, 7.9, { ukuran: 8, warna: [107, 114, 128] });
    y += 7.9;
  }
  area.forEach((g, ai) => {
    const bArea = bungkus(g.nama, kI[1], 8, 3);
    const hArea = Math.max(7.6, bArea.length * 3.4 + 3);
    muat(hArea + 7.6 + 6.5);
    baris4(hArea);
    tengah(huruf(ai), xI[0], y, kI[0], hArea, { tebal: true, ukuran: 8 });
    sel(bArea, xI[1], y, kI[1], hArea, { tebal: true, ukuran: 8 });
    y += hArea;
    g.item.forEach((it, i) => {
      const bNama = bungkus(`${it.nama}${it.kode ? ` (${it.kode})` : ""}`, kI[1], 8, 3);
      const catatan = Math.abs(it.naik) > 0.005 ? `${it.naik > 0 ? "Naik" : "Turun"} ${ringkas(Math.abs(it.naik))} minggu ini` : "";
      const h = Math.max(7.6, bNama.length * 3.4 + 3);
      muat(h);
      baris4(h);
      tengah(String(i + 1), xI[0], y, kI[0], h, { ukuran: 8 });
      sel(bNama, xI[1], y, kI[1], h, { ukuran: 8 });
      tengah(ringkas(it.sesudah), xI[2], y, kI[2], h, { ukuran: 8 });
      if (catatan) sel([catatan], xI[3], y, kI[3], h, { ukuran: 8 });
      y += h;
    });
    if (ai < area.length - 1) {
      muat(6.5);
      baris4(6.5);
      y += 6.5;
    }
  });

  // ---------- Dokumentasi ----------
  if (foto.length) {
    y += 14;
    const lebarSel = W / 2;
    const tinggiFoto = 66;
    const tinggiKet = 7.5;
    muat(9 + tinggiFoto + tinggiKet);
    kotak(L, y, W, 9);
    tengah("DOKUMENTASI", L, y, W, 9, { tebal: true, ukuran: 10 });
    y += 9;
    for (let i = 0; i < foto.length; i += 2) {
      muat(tinggiFoto + tinggiKet);
      [foto[i], foto[i + 1]].forEach((f, c) => {
        const cx = L + c * lebarSel;
        kotak(cx, y, lebarSel, tinggiFoto + tinggiKet);
        if (!f) return;
        const ket = doc.setFont("helvetica", "normal").setFontSize(8).splitTextToSize(bersih(f.keterangan), lebarSel - 4).slice(0, 1);
        tengah(ket[0] || "", cx, y + tinggiFoto, lebarSel, tinggiKet, { ukuran: 8 });
        const fmt = formatGambar(f.data);
        if (!fmt) {
          tengah("(foto tidak dapat ditampilkan)", cx, y, lebarSel, tinggiFoto, { ukuran: 8, warna: [156, 163, 175] });
          return;
        }
        try {
          const p = doc.getImageProperties(f.data);
          const skala = Math.min((lebarSel - 4) / p.width, (tinggiFoto - 4) / p.height);
          const fw = p.width * skala;
          const fh = p.height * skala;
          doc.addImage(f.data, fmt, cx + (lebarSel - fw) / 2, y + (tinggiFoto - fh) / 2, fw, fh, undefined, "FAST");
        } catch {
          tengah("(foto tidak dapat ditampilkan)", cx, y, lebarSel, tinggiFoto, { ukuran: 8, warna: [156, 163, 175] });
        }
      });
      y += tinggiFoto + tinggiKet;
    }
    if (fotoLebih > 0) teks(`+ ${fotoLebih} foto lain minggu ini tidak dimuat di PDF (lihat di aplikasi).`, L, y + 4, { ukuran: 8, warna: [107, 114, 128] });
  }

  return doc.output("arraybuffer");
}
