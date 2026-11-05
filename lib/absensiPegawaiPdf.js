import { jsPDF } from "jspdf";
import { bersih, formatGambar } from "./laporanHarianPdf.js";
import { NAMA_BULAN, formatJam, durasiKerja } from "./absensiPegawaiAturan.js";

// PDF absensi pegawai untuk SATU bulan kalender: halaman ringkasan, lalu satu
// bagian per orang berisi baris per hari (jam, alamat, foto masuk & pulang).
// A4 portrait, satuan milimeter. Pola kode mengikuti lib/laporanHarianPdf.js.

const L = 12.5;
const W = 185;
const BAWAH = 283;
const TINGGI_BARIS = 40;
const KOLOM_FOTO = 44;
const KOLOM_TEKS = W - KOLOM_FOTO * 2 - 4;

const tglPanjang = (tanggal) =>
  new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

const koordinat = (lat, lng) => (lat == null ? "-" : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`);

// pegawai: [{ id, name }]
// baris: baris absensi_pegawai + { fotoMasuk, fotoKeluar } (Uint8Array | null)
// Return ArrayBuffer siap dikirim / diunggah.
export function buatPdfAbsensiBulanan({ bulan, pegawai, baris, logo, sementara, hariIni }) {
  const [tahun, bln] = bulan.split("-").map(Number);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setLineWidth(0.2).setDrawColor(40, 40, 40);

  const teks = (str, x, y, o = {}) => {
    doc
      .setFont("helvetica", o.tebal ? "bold" : "normal")
      .setFontSize(o.ukuran || 8.5)
      .setTextColor(...(o.warna || [30, 30, 30]));
    doc.text(str, x, y, { align: o.rata || "left", baseline: o.baseline || "middle" });
  };
  const kotak = (x, y, w, h, isi) => {
    if (isi) doc.setFillColor(...isi).rect(x, y, w, h, "FD");
    else doc.rect(x, y, w, h, "S");
  };

  const perOrang = new Map();
  for (const r of baris) {
    if (!perOrang.has(r.profile_id)) perOrang.set(r.profile_id, []);
    perOrang.get(r.profile_id).push(r);
  }
  const ringkas = (rows) => ({
    hadir: rows.length,
    telat: rows.filter((r) => r.terlambat).length,
    cepat: rows.filter((r) => r.pulang_cepat).length,
    tanpaPulang: rows.filter((r) => !r.keluar_at && r.tanggal < hariIni).length,
  });
  const urut = [...pegawai].sort((a, b) => a.name.localeCompare(b.name, "id"));

  // ---------- Halaman ringkasan ----------
  let y = 14;
  if (formatGambar(logo)) {
    try {
      const p = doc.getImageProperties(logo);
      const lw = 30;
      doc.addImage(logo, formatGambar(logo), L, y, lw, (lw * p.height) / p.width, undefined, "FAST");
      y += (lw * p.height) / p.width + 6;
    } catch {
      y += 4;
    }
  }
  teks("ABSENSI PEGAWAI", L, y + 4, { tebal: true, ukuran: 18 });
  teks(`${NAMA_BULAN[bln - 1]} ${tahun}`, L, y + 12, { ukuran: 12 });
  if (sementara)
    teks("Sementara - bulan ini masih berjalan, data belum final.", L, y + 18, { ukuran: 8.5, warna: [185, 28, 28] });
  y += 26;

  const kol = [W - 4 * 24, 24, 24, 24, 24];
  const head = ["NAMA", "HADIR", "TERLAMBAT", "PULANG CEPAT", "TANPA PULANG"];
  let x = L;
  head.forEach((h, i) => {
    kotak(x, y, kol[i], 7.5, [237, 237, 237]);
    teks(h, i === 0 ? x + 2 : x + kol[i] / 2, y + 3.75, { tebal: true, ukuran: 7.5, rata: i === 0 ? "left" : "center" });
    x += kol[i];
  });
  y += 7.5;
  urut.forEach((p) => {
    const s = ringkas(perOrang.get(p.id) || []);
    x = L;
    [bersih(p.name), s.hadir, s.telat, s.cepat, s.tanpaPulang].forEach((v, i) => {
      kotak(x, y, kol[i], 7);
      teks(String(v), i === 0 ? x + 2 : x + kol[i] / 2, y + 3.5, { rata: i === 0 ? "left" : "center" });
      x += kol[i];
    });
    y += 7;
  });
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  doc
    .splitTextToSize(
      "Keterangan: terlambat = masuk setelah 09:00 WIB; pulang cepat = pulang sebelum 17:00 WIB; tanpa pulang = hari yang sudah lewat tanpa absen pulang.",
      W
    )
    .forEach((b, i) => teks(b, L, y + i * 3.6, { ukuran: 7.5, warna: [107, 114, 128] }));

  // ---------- Satu bagian per orang ----------
  const gambar = (foto, bx, by, bw, bh) => {
    kotak(bx, by, bw, bh, [250, 250, 250]);
    const fmt = formatGambar(foto);
    if (!fmt) {
      teks("(foto tidak tersedia)", bx + bw / 2, by + bh / 2, { ukuran: 7, warna: [156, 163, 175], rata: "center" });
      return;
    }
    try {
      const p = doc.getImageProperties(foto);
      const skala = Math.min((bw - 1) / p.width, (bh - 1) / p.height);
      const fw = p.width * skala;
      const fh = p.height * skala;
      doc.addImage(foto, fmt, bx + (bw - fw) / 2, by + (bh - fh) / 2, fw, fh, undefined, "FAST");
    } catch {
      teks("(foto tidak dapat ditampilkan)", bx + bw / 2, by + bh / 2, { ukuran: 7, warna: [156, 163, 175], rata: "center" });
    }
  };

  for (const p of urut) {
    const rows = perOrang.get(p.id);
    if (!rows?.length) continue;
    const s = ringkas(rows);

    const kepala = () => {
      doc.addPage();
      kotak(L, 14, W, 9, [237, 237, 237]);
      teks(bersih(p.name), L + 2, 18.5, { tebal: true, ukuran: 11 });
      teks(`${NAMA_BULAN[bln - 1]} ${tahun}`, L + W - 2, 18.5, { ukuran: 9, rata: "right" });
      teks(
        `${s.hadir} hadir · ${s.telat} terlambat · ${s.cepat} pulang cepat · ${s.tanpaPulang} tanpa pulang`,
        L,
        27,
        { ukuran: 8, warna: [75, 85, 99] }
      );
      return 31;
    };

    y = kepala();
    for (const r of rows) {
      if (y + TINGGI_BARIS > BAWAH) y = kepala();

      kotak(L, y, W, TINGGI_BARIS);
      // Kolom teks
      let ty = y + 5;
      teks(bersih(tglPanjang(r.tanggal)), L + 2, ty, { tebal: true, ukuran: 9 });
      ty += 5.5;
      const baris1 = `Masuk ${formatJam(r.masuk_at)}${r.terlambat ? "  (terlambat)" : ""}`;
      teks(baris1, L + 2, ty, { ukuran: 8.5, warna: r.terlambat ? [185, 28, 28] : [22, 128, 61], tebal: true });
      ty += 4;
      const alamatMasuk = bersih(r.alamat_masuk || r.lokasi_masuk || koordinat(r.lat_masuk, r.lng_masuk));
      doc.setFont("helvetica", "normal").setFontSize(7);
      doc.splitTextToSize(alamatMasuk, KOLOM_TEKS - 4).slice(0, 3).forEach((b) => {
        teks(b, L + 2, ty, { ukuran: 7, warna: [75, 85, 99] });
        ty += 3.2;
      });
      ty += 1.5;
      if (r.keluar_at) {
        teks(
          `Pulang ${formatJam(r.keluar_at)}${r.pulang_cepat ? "  (lebih awal)" : ""}  -  ${durasiKerja(r.masuk_at, r.keluar_at)} jam`,
          L + 2,
          ty,
          { ukuran: 8.5, tebal: true, warna: r.pulang_cepat ? [194, 84, 15] : [30, 30, 30] }
        );
        ty += 4;
        const alamatPulang = bersih(r.alamat_keluar || r.lokasi_keluar || koordinat(r.lat_keluar, r.lng_keluar));
        doc.setFont("helvetica", "normal").setFontSize(7);
        doc.splitTextToSize(alamatPulang, KOLOM_TEKS - 4).slice(0, 3).forEach((b) => {
          teks(b, L + 2, ty, { ukuran: 7, warna: [75, 85, 99] });
          ty += 3.2;
        });
      } else {
        teks(
          r.tanggal < hariIni ? "Tidak absen pulang" : "Belum absen pulang",
          L + 2,
          ty,
          { ukuran: 8.5, warna: [156, 163, 175] }
        );
      }

      // Foto masuk & pulang
      const fx = L + KOLOM_TEKS + 2;
      gambar(r.fotoMasuk, fx, y + 1, KOLOM_FOTO, TINGGI_BARIS - 2);
      gambar(r.fotoKeluar, fx + KOLOM_FOTO + 1, y + 1, KOLOM_FOTO, TINGGI_BARIS - 2);
      y += TINGGI_BARIS;
    }
  }

  // ---------- Nomor halaman ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    teks(`Halaman ${i} / ${total}`, L + W, 291, { ukuran: 7.5, rata: "right", warna: [156, 163, 175] });
  }

  return doc.output("arraybuffer");
}
