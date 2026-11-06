import { jsPDF } from "jspdf";
import { bersih, formatGambar } from "../laporanHarianPdf.js";

// PDF laporan mingguan satu proyek tracker (Portal Klien), gayanya mengikuti
// PDF laporan harian (lib/laporanHarianPdf.js): kop + logo, ringkasan progres,
// tahap yang dikerjakan, item yang bergerak, tanda tangan, lalu dokumentasi foto.
// Tidak memuat nilai rupiah (jasa tukang / nilai proyek), jadi aman untuk supervisor.
// Satuan milimeter, A4.

const PEMERIKSA = { nama: "Jovial Timidiba", jabatan: "Principal" };

const L = 12.5;
const W = 185;
const R = L + W;
const BAWAH = 285;
const GARIS = 0.2;

const tglPendek = (tgl) => tgl.split("-").reverse().join("/");
const persen = (n) => `${(Math.round(n * 10) / 10).toFixed(1).replace(".", ",")}%`;
const naikTeks = (n) => `${n > 0.005 ? "+" : ""}${persen(n)}`;

// data: {
//   proyek, lokasi, spk, client, supervisor, minggu: { no, mulai, akhir, berjalan },
//   hasil: { sebelum, sesudah, naik, tahap: [{ label, poin, bagian }] },
//   item: [{ area, nama, tim, sebelum, sesudah, naik }],
//   foto: [{ data: Uint8Array | null, keterangan }], fotoLebih: jumlah foto yang tidak dimuat,
//   logo: Uint8Array | null, dibuat: "YYYY-MM-DD"
// }
// Return ArrayBuffer siap dikirim sebagai response.
export function buatPdfLaporanMingguan(data) {
  const { proyek, lokasi, spk, client, supervisor, minggu, hasil, item, foto = [], fotoLebih = 0, logo } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setLineWidth(GARIS).setDrawColor(40, 40, 40);

  const kotak = (x, y, w, h, isi) => {
    if (isi) doc.setFillColor(...isi).rect(x, y, w, h, "FD");
    else doc.rect(x, y, w, h, "S");
  };
  const teks = (str, x, y, o = {}) => {
    doc
      .setFont("helvetica", o.tebal ? "bold" : "normal")
      .setFontSize(o.ukuran || 8.5)
      .setTextColor(...(o.warna || [30, 30, 30]));
    doc.text(str, x, y, { align: o.rata || "left", baseline: "middle" });
  };
  const tengah = (str, x, y, w, h, o = {}) => teks(str, x + w / 2, y + h / 2, { ...o, rata: "center" });

  // ---------- Kop ----------
  const yKop = 14;
  kotak(L, yKop, 44, 45.5);
  const fmtLogo = formatGambar(logo);
  if (fmtLogo) {
    try {
      const p = doc.getImageProperties(logo);
      const lw = 36;
      const lh = (lw * p.height) / p.width;
      doc.addImage(logo, fmtLogo, L + 4, yKop + (45.5 - lh) / 2, lw, lh, undefined, "FAST");
    } catch {}
  }
  const xJ = L + 46.3;
  const wJ = R - xJ;
  kotak(xJ, yKop, wJ, 29);
  tengah("WEEKLY PROGRESS", xJ, yKop, wJ, 29, { tebal: true, ukuran: 20 });
  kotak(xJ, yKop + 29, wJ, 7.6);
  tengah("PT Taraco Design", xJ, yKop + 29, wJ, 7.6, { ukuran: 9.5 });
  kotak(xJ, yKop + 36.6, wJ, 8.9, [237, 237, 237]);
  tengah(`Proyek : ${bersih(proyek) || "-"}`, xJ, yKop + 36.6, wJ, 8.9, { tebal: true, ukuran: 10 });

  // ---------- Info ----------
  const info = [
    [["SPK", bersih(spk) || "-"], ["Minggu ke", `${minggu.no}${minggu.berjalan ? " (berjalan)" : ""}`]],
    [["Lokasi", bersih(lokasi) || "-"], ["Periode", `${tglPendek(minggu.mulai)} - ${tglPendek(minggu.akhir)}`]],
    [["Client", bersih(client) || "-"], null],
  ];
  info.forEach(([kiri, kanan], i) => {
    const y = yKop + 45.5 + 6 + i * 5.4;
    teks(kiri[0], L, y);
    teks(`: ${kiri[1]}`, L + 19, y);
    if (kanan) {
      teks(kanan[0], 108.5, y);
      teks(`: ${kanan[1]}`, 127.5, y);
    }
  });

  let y = yKop + 45.5 + 6 + 3 * 5.4 + 4;
  const halamanBaru = () => {
    doc.addPage();
    y = 14;
  };

  // ---------- Ringkasan progres ----------
  kotak(L, y, W, 8.6);
  tengah("PROGRES PROYEK", L, y, W, 8.6, { tebal: true });
  y += 8.6;
  const kolR = [W / 3, W / 3, W / 3];
  const isiR = [
    ["SEBELUM (awal minggu)", persen(hasil.sebelum)],
    ["SESUDAH (akhir minggu)", persen(hasil.sesudah)],
    ["KENAIKAN", naikTeks(hasil.naik)],
  ];
  isiR.forEach(([judul, nilai], i) => {
    const x = L + i * kolR[0];
    kotak(x, y, kolR[0], 6.9);
    tengah(judul, x, y, kolR[0], 6.9, { tebal: true, ukuran: 8 });
    kotak(x, y + 6.9, kolR[0], 9);
    const warna = i === 2 ? (hasil.naik > 0.005 ? [22, 128, 61] : hasil.naik < -0.005 ? [185, 28, 28] : [30, 30, 30]) : [30, 30, 30];
    tengah(nilai, x, y + 6.9, kolR[0], 9, { tebal: true, ukuran: 11, warna });
  });
  y += 6.9 + 9 + 3.3;

  // ---------- Tahap yang dikerjakan ----------
  const kT = [14.5, W - 14.5 - 45 - 45, 45, 45];
  kotak(L, y, W, 8.6);
  tengah("TAHAP YANG DIKERJAKAN", L, y, W, 8.6, { tebal: true });
  y += 8.6;
  const headT = ["NO", "TAHAP", "KENAIKAN PROGRES PROYEK", "BAGIAN DARI MINGGU INI"];
  let x = L;
  headT.forEach((h, i) => {
    kotak(x, y, kT[i], 7.2);
    tengah(h, x, y, kT[i], 7.2, { tebal: true, ukuran: 7.5 });
    x += kT[i];
  });
  y += 7.2;
  if (!hasil.tahap.length) {
    kotak(L, y, W, 7.9);
    tengah("Tidak ada tahap yang dikerjakan minggu ini.", L, y, W, 7.9, { warna: [107, 114, 128] });
    y += 7.9;
  }
  hasil.tahap.forEach((t, i) => {
    if (y + 7.9 > BAWAH) halamanBaru();
    x = L;
    const isi = [String(i + 1), bersih(t.label), `+${persen(t.poin)}`, persen(t.bagian)];
    isi.forEach((v, k) => {
      kotak(x, y, kT[k], 7.9);
      if (k === 1) teks(v, x + 2, y + 3.95);
      else tengah(v, x, y, kT[k], 7.9);
      x += kT[k];
    });
    y += 7.9;
  });
  y += 3.3;

  // ---------- Item yang bergerak ----------
  const kI = [10, 34, 62, 31, 16, 16, 16];
  const headI = ["NO", "AREA", "ITEM", "TIM", "SEBELUM", "SESUDAH", "NAIK"];
  const headerItem = () => {
    let xx = L;
    headI.forEach((h, i) => {
      kotak(xx, y, kI[i], 7.2);
      tengah(h, xx, y, kI[i], 7.2, { tebal: true, ukuran: 8 });
      xx += kI[i];
    });
    y += 7.2;
  };
  if (y + 8.6 + 7.2 + 8 > BAWAH) halamanBaru();
  kotak(L, y, W, 8.6);
  tengah("KEGIATAN (ITEM YANG ADA PERUBAHAN PROGRES)", L, y, W, 8.6, { tebal: true });
  y += 8.6;
  headerItem();
  if (!item.length) {
    kotak(L, y, W, 7.9);
    tengah("Tidak ada perubahan progres item minggu ini.", L, y, W, 7.9, { warna: [107, 114, 128] });
    y += 7.9;
  }
  item.forEach((it, i) => {
    doc.setFont("helvetica", "normal").setFontSize(8);
    const bNama = doc.splitTextToSize(bersih(it.nama) || "-", kI[2] - 4).slice(0, 3);
    const bArea = doc.splitTextToSize(bersih(it.area) || "-", kI[1] - 4).slice(0, 3);
    const bTim = doc.splitTextToSize(bersih(it.tim) || "-", kI[3] - 4).slice(0, 3);
    const h = Math.max(7.9, Math.max(bNama.length, bArea.length, bTim.length) * 3.8 + 4);
    if (y + h > BAWAH) {
      halamanBaru();
      headerItem();
    }
    const kolom = [String(i + 1), null, null, null, persen(it.sebelum), persen(it.sesudah), naikTeks(it.naik)];
    let xx = L;
    kI.forEach((lebar, k) => {
      kotak(xx, y, lebar, h);
      if (k === 1) bArea.forEach((b, j) => teks(b, xx + 2, y + 3.95 + j * 3.8, { ukuran: 8 }));
      else if (k === 2) bNama.forEach((b, j) => teks(b, xx + 2, y + 3.95 + j * 3.8, { ukuran: 8 }));
      else if (k === 3) bTim.forEach((b, j) => teks(b, xx + 2, y + 3.95 + j * 3.8, { ukuran: 8 }));
      else if (k === 6) tengah(kolom[k], xx, y, lebar, h, { tebal: true, ukuran: 8, warna: it.naik < -0.005 ? [185, 28, 28] : [22, 128, 61] });
      else tengah(kolom[k], xx, y, lebar, h, { ukuran: 8 });
      xx += lebar;
    });
    y += h;
  });

  // ---------- Tanda tangan ----------
  if (y + 35 > 292) halamanBaru();
  y += 12;
  teks("Diajukan Oleh:", 15, y);
  teks("Diperiksa Oleh:", 108.5, y);
  y += 15;
  teks(bersih(supervisor) || "-", 15, y + 4);
  teks(PEMERIKSA.nama, 108.5, y);
  teks(PEMERIKSA.jabatan, 108.5, y + 4, { ukuran: 8 });

  // ---------- Dokumentasi ----------
  if (foto.length) {
    halamanBaru();
    kotak(L, y, W, 8.6);
    tengah("DOKUMENTASI", L, y, W, 8.6, { tebal: true, ukuran: 9.5 });
    y += 8.6;

    const lebarSel = W / 2;
    const tinggiFoto = 67;
    const tinggiBaris = tinggiFoto + 10;
    for (let i = 0; i < foto.length; i += 2) {
      if (y + tinggiBaris > BAWAH + 5) halamanBaru();
      [foto[i], foto[i + 1]].forEach((f, k) => {
        const cx = L + k * lebarSel;
        kotak(cx, y, lebarSel, tinggiFoto, [250, 250, 250]);
        kotak(cx, y + tinggiFoto, lebarSel, 10);
        if (!f) return;
        const ket = doc.setFont("helvetica", "normal").setFontSize(7.5).splitTextToSize(`${i + k + 1}. ${bersih(f.keterangan)}`, lebarSel - 4).slice(0, 2);
        ket.forEach((b, j) => teks(b, cx + 2, y + tinggiFoto + 3.2 + j * 3.6, { ukuran: 7.5 }));
        const fmt = formatGambar(f.data);
        if (!fmt) {
          tengah("(foto tidak dapat ditampilkan)", cx, y, lebarSel, tinggiFoto, { ukuran: 8, warna: [156, 163, 175] });
          return;
        }
        try {
          const p = doc.getImageProperties(f.data);
          const skala = Math.min((lebarSel - 6) / p.width, (tinggiFoto - 2) / p.height);
          const fw = p.width * skala;
          const fh = p.height * skala;
          doc.addImage(f.data, fmt, cx + (lebarSel - fw) / 2, y + (tinggiFoto - fh) / 2, fw, fh, undefined, "FAST");
        } catch {
          tengah("(foto tidak dapat ditampilkan)", cx, y, lebarSel, tinggiFoto, { ukuran: 8, warna: [156, 163, 175] });
        }
      });
      y += tinggiBaris;
    }
    if (fotoLebih > 0) teks(`+ ${fotoLebih} foto lain minggu ini tidak dimuat di PDF (lihat di aplikasi).`, L, y + 3, { ukuran: 8, warna: [107, 114, 128] });
  }

  return doc.output("arraybuffer");
}
