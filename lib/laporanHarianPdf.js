import { jsPDF } from "jspdf";
import { susunManpower } from "./manpower.js";

// Format mengikuti contoh resmi "Daily Report-FC house" (A4): kop + logo,
// tabel MAN POWER, tabel KEGIATAN, tanda tangan, lalu halaman DOKUMENTASI
// (foto 2 kolom bernomor). Satuan milimeter.

const PEMERIKSA = { nama: "Jovial Timidiba", jabatan: "Principal" };

const KET = {
  ON_PROGRESS: { label: "On Progress", warna: [194, 84, 15] },
  DONE: { label: "Done", warna: [22, 128, 61] },
  PERBAIKAN: { label: "Perbaikan", warna: [185, 28, 28] },
};

const L = 12.5; // margin kiri
const W = 185; // lebar tabel
const R = L + W;
const BAWAH = 285; // batas bawah konten
const GARIS = 0.2;

// Font bawaan PDF (Helvetica) hanya mengenal Latin-1: tanda baca "cantik"
// diganti yang setara, sisanya (emoji dsb.) dibuang supaya tidak jadi sampah.
const bersih = (s) =>
  String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\n\t\x20-\x7E\xA0-\xFF]/g, "");

// Deteksi format dari byte awal; jsPDF tidak menebaknya dari Uint8Array.
function formatGambar(b) {
  if (!b || b.length < 13) return null;
  if (b[0] === 0xff && b[1] === 0xd8) return "JPEG";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "PNG";
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "WEBP";
  return null;
}

const tglPendek = (tgl) => tgl.split("-").reverse().join("/");

// Satu PDF = laporan harian satu proyek pada satu tanggal.
// items: [{ status, deskripsi, foto: Uint8Array | null }]
// manpower: baris laporan_manpower; logo: Uint8Array PNG | null.
// spk/client: dari Taraco (code, client); null tampil "-".
// Return ArrayBuffer siap dikirim sebagai response.
export function buatPdfLaporanHarian({ proyek, lokasi, spk, client, supervisor, tanggal, items, manpower, logo }) {
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
  tengah("DAILY PROGRESS", xJ, yKop, wJ, 29, { tebal: true, ukuran: 20 });
  kotak(xJ, yKop + 29, wJ, 7.6);
  tengah("PT Taraco Design", xJ, yKop + 29, wJ, 7.6, { ukuran: 9.5 });
  kotak(xJ, yKop + 36.6, wJ, 8.9, [237, 237, 237]);
  tengah(`Proyek : ${bersih(proyek) || "-"}`, xJ, yKop + 36.6, wJ, 8.9, { tebal: true, ukuran: 10 });

  // ---------- Info ----------
  const info = [
    [["SPK", bersih(spk) || "-"], ["Add", "-"]],
    [["Lokasi", bersih(lokasi) || "-"], ["Tanggal", tglPendek(tanggal)]],
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

  // ---------- Man Power ----------
  let y = yKop + 45.5 + 6 + 3 * 5.4 + 4;
  const kolMp = [10.9, 48.7, 25, 25.2, 25.2, 25.2, 24.8];
  const headMp = ["NO", "KLASIFIKASI", "AKTIF (Site)", "AKTIF (Ws)", "LEMBUR", "ALPHA", "JUMLAH"];
  kotak(L, y, W, 8.6);
  tengah("MAN POWER", L, y, W, 8.6, { tebal: true });
  y += 8.6;
  let x = L;
  headMp.forEach((h, i) => {
    kotak(x, y, kolMp[i], 6.9);
    tengah(h, x, y, kolMp[i], 6.9, { tebal: true, ukuran: 8 });
    x += kolMp[i];
  });
  y += 6.9;
  susunManpower(manpower).forEach((m, r) => {
    x = L;
    const tampil = (v) => (v ? String(v) : "");
    const isi = [String(r + 1), m.nama, tampil(m.aktif_site), tampil(m.aktif_ws), tampil(m.lembur), tampil(m.alpha), tampil(m.jumlah)];
    isi.forEach((v, i) => {
      kotak(x, y, kolMp[i], 7.8);
      if (i === 1) teks(v, x + 2, y + 3.9);
      else tengah(v, x, y, kolMp[i], 7.8);
      x += kolMp[i];
    });
    y += 7.8;
  });

  // ---------- Kegiatan ----------
  y += 3.3;
  const kNo = 14.5;
  const kKet = 55.3;
  const kUrai = W - kNo - kKet;
  kotak(L, y, W, 8.6);
  tengah("KEGIATAN", L, y, W, 8.6, { tebal: true });
  y += 8.6;

  const headerKegiatan = () => {
    kotak(L, y, kNo, 7.2);
    tengah("NO", L, y, kNo, 7.2, { tebal: true, ukuran: 8 });
    kotak(L + kNo, y, kUrai, 7.2);
    tengah("KEJADIAN & KEGIATAN LAPANGAN", L + kNo, y, kUrai, 7.2, { tebal: true, ukuran: 8 });
    kotak(L + kNo + kUrai, y, kKet, 7.2);
    tengah("KET.", L + kNo + kUrai, y, kKet, 7.2, { tebal: true, ukuran: 8 });
    y += 7.2;
  };
  headerKegiatan();
  kotak(L, y, W, 8);
  teks("PROGRESS TIM OFFICE ONSITE", L + 2, y + 4);
  y += 8;

  items.forEach((it, i) => {
    const baris = doc.setFont("helvetica", "normal").setFontSize(8.5).splitTextToSize(bersih(it.deskripsi) || "-", kUrai - 4);
    const h = Math.max(7.9, baris.length * 4 + 3.9);
    if (y + h > BAWAH) {
      doc.addPage();
      y = 14;
      headerKegiatan();
    }
    const ket = KET[it.status] || KET.ON_PROGRESS;
    kotak(L, y, kNo, h);
    tengah(String(i + 1), L, y, kNo, h);
    kotak(L + kNo, y, kUrai, h);
    baris.forEach((b, j) => teks(b, L + kNo + 2, y + 3.95 + j * 4));
    kotak(L + kNo + kUrai, y, kKet, h);
    tengah(ket.label, L + kNo + kUrai, y, kKet, h, { warna: ket.warna });
    y += h;
  });

  // ---------- Tanda tangan ----------
  if (y + 35 > 292) {
    doc.addPage();
    y = 14;
  }
  y += 12;
  teks("Diajukan Oleh:", 15, y);
  teks("Diperiksa Oleh:", 108.5, y);
  y += 15;
  teks(bersih(supervisor) || "-", 15, y + 4, { tebal: false });
  teks(PEMERIKSA.nama, 108.5, y, { tebal: false });
  teks(PEMERIKSA.jabatan, 108.5, y + 4, { ukuran: 8 });

  // ---------- Dokumentasi ----------
  const berFoto = items.map((it, i) => ({ ...it, no: i + 1 })).filter((it) => it.foto?.length);
  if (berFoto.length) {
    doc.addPage();
    y = 14;
    kotak(L, y, W, 8.6);
    tengah("DOKUMENTASI", L, y, W, 8.6, { tebal: true, ukuran: 9.5 });
    y += 8.6;

    const lebarSel = W / 2;
    const tinggiFoto = 67;
    const tinggiBaris = tinggiFoto + 8;
    for (let i = 0; i < berFoto.length; i += 2) {
      if (y + tinggiBaris > BAWAH + 5) {
        doc.addPage();
        y = 14;
      }
      [berFoto[i], berFoto[i + 1]].forEach((it, k) => {
        const cx = L + k * lebarSel;
        kotak(cx, y, lebarSel, tinggiFoto, [250, 250, 250]);
        kotak(cx, y + tinggiFoto, lebarSel, 8);
        if (!it) return;
        tengah(String(it.no), cx, y + tinggiFoto, lebarSel, 8, { tebal: true, ukuran: 8 });
        const fmt = formatGambar(it.foto);
        if (!fmt) {
          tengah("(foto tidak dapat ditampilkan)", cx, y, lebarSel, tinggiFoto, { ukuran: 8, warna: [156, 163, 175] });
          return;
        }
        try {
          const p = doc.getImageProperties(it.foto);
          const skala = Math.min((lebarSel - 6) / p.width, (tinggiFoto - 2) / p.height);
          const fw = p.width * skala;
          const fh = p.height * skala;
          doc.addImage(it.foto, fmt, cx + (lebarSel - fw) / 2, y + (tinggiFoto - fh) / 2, fw, fh, undefined, "FAST");
        } catch {
          tengah("(foto tidak dapat ditampilkan)", cx, y, lebarSel, tinggiFoto, { ukuran: 8, warna: [156, 163, 175] });
        }
      });
      y += tinggiBaris;
    }
  }

  return doc.output("arraybuffer");
}
