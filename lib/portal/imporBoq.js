// Baca teks yang ditempel dari Excel menjadi baris item BOQ.
//
// Format utama = template "Bill Of Quantity (BoQ)" Taraco, satu sheet disalin
// utuh (Ctrl+A, Ctrl+C):
//   No. | Uraian | Panjang | Lebar | Tinggi | Qty | Keterangan
//   II  | PEKERJAAN INTERIOR                      <- bagian (angka romawi)
//   A   | FOYER                                   <- area (huruf)
//   1   | Shoe Rack (FF.01) / Plywood ... | 1,65 | 0,4 | 2,3 | 1   <- item utama
//       | Rel Sliding soft close          |      |     |     | 1   <- aksesoris, dilewati
// Hanya baris bernomor yang diambil; aksesoris (tanpa nomor), "Sub Total",
// dan kepala surat dilewati.
//
// Sheet lama memakai dua gaya lain, keduanya ikut dibaca:
//   - kolom No. berisi kode item langsung ("IF-01", "FU2", "B.1");
//   - tanpa nomor item sama sekali (hanya huruf area). Di sini item TEBAKAN:
//     baris yang punya minimal dua dimensi. Lihat formatLama().
//
// Format lama (9 kolom: Area · Kode · Nama · Jenis · Qty · Satuan · Dimensi ·
// Harga · Bobot) tetap dibaca kalau teksnya bukan dari template.
import { JENIS, tebakJenis } from "./progresBoq";
import { angka } from "./format";

// Excel membungkus sel yang berisi ganti baris dengan tanda kutip, jadi teks
// tidak bisa dipecah per baris begitu saja.
export function bacaTsv(teks) {
  const rows = [];
  let row = [], sel = "", kutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (kutip) {
      if (c !== '"') sel += c;
      else if (teks[i + 1] === '"') { sel += '"'; i++; }
      else kutip = false;
    } else if (c === '"' && sel === "") kutip = true;
    else if (c === "\t") { row.push(sel); sel = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      row.push(sel); rows.push(row); row = []; sel = "";
    } else sel += c;
  }
  row.push(sel);
  rows.push(row);
  return rows;
}

const rapi = (s) => (s || "").replace(/\s+/g, " ").trim();
const judul = (s) => rapi(s).toLowerCase().replace(/(^|[\s(/&-])\p{L}/gu, (m) => m.toUpperCase());
const ROMAWI = /^(X{0,3})(IX|IV|V?I{0,3})$/;
const NOMOR = /^\d+([.,]0+)?$/;
const KODE = /^[A-Z]{1,3} ?[-.]? ?\d{1,3}[A-Z]?$/i;
const noBaris = (r) => rapi(r[0]).replace(/\.$/, "");
const barisItem = (r) => (NOMOR.test(noBaris(r)) || KODE.test(noBaris(r))) && !!rapi(r[1]);
// Dimensi tidak pernah memakai pemisah ribuan, jadi "0.735" = 0,735 (bukan 735).
const bil = (s) => (/^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : null);
const tulis = (n) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });

// Bobot awal item = luas muka (dua sisi terpanjang, m²) × qty: perkiraan kasar
// nilai item selama harga belum diisi, supaya kitchen set tidak setara cermin.
// Sheet lama kadang menulis cm/mm, jadi angka besar dianggap bukan meter.
// Tanpa dimensi -> 1. Admin bisa mengubahnya per item.
const meter = (v) => (v > 1000 ? v / 1000 : v > 20 ? v / 100 : v);
function taksirBobot(dims, qty) {
  if (dims.length < 2) return 1;
  const [a, b] = dims.map(meter).sort((x, y) => y - x);
  return Math.min(9999, Math.max(0.1, Math.round(a * b * qty * 100) / 100));
}

export const dariTemplate = (rows) => rows.some(barisItem);

// true = sheet gaya lama tanpa nomor item; hasil bacaBaris() perlu diperiksa admin.
export const formatLama = (rows) => !rows.some(barisItem);

function bacaTemplate(rows) {
  const out = [];
  const tanpaNomor = formatLama(rows);
  let seksi = "", area = "", hurufLalu = "";
  // Sheet dengan kolom "Gambar" (C): Panjang, Lebar, Tinggi, Qty, Harga, Total
  // bergeser satu kolom ke kanan. Kolom itu dibuang supaya urutannya sama dengan template.
  const adaGambar = rows.some((r) => /^gambar$/i.test(rapi(r[2])));
  // Sheet Hitungan Jasa Pekerjaan = punya kolom "Harga Satuan".
  const jasaSheet = rows.some((r) => r.some((x) => /^harga\s*satuan$/i.test(rapi(x))));
  for (const r of rows) {
    const semua = r.map(rapi);
    const c = adaGambar ? [semua[0], semua[1], ...semua.slice(3)] : semua;
    const no = noBaris(r);
    if (!c[1]) continue;

    if (/^[A-Z]{1,4}$/.test(no)) {
      // "I", "V", "X" bisa berarti huruf area atau angka romawi: dianggap huruf
      // hanya kalau memang lanjutan urutan area (… H, I).
      const berikut = hurufLalu ? String.fromCharCode(hurufLalu.charCodeAt(0) + 1) : "A";
      if (no.length === 1 && (no === berikut || !ROMAWI.test(no))) { area = judul(c[1]); hurufLalu = no; }
      else if (ROMAWI.test(no)) { seksi = judul(c[1]); area = ""; hurufLalu = ""; }
      continue;
    }
    const kodeDiNo = KODE.test(no);
    // Sheet jasa: baris tanpa nomor tapi punya kode "(IF 1)", dimensi, dan harga
    // sendiri = item sungguhan (mis. "Kabinet Sepatu" di bawah "Bench"), bukan
    // aksesoris seperti LED strip / stopkontak yang tanpa kode dan dimensi.
    const takBernomor =
      !no && !!area && /\([^)]{1,12}\)/.test(r[1].split(/\n|\s{3,}/)[0] || "") &&
      [c[2], c[3], c[4]].filter((x) => bil(x) != null).length >= 2 && angka(c[7]) != null;
    // Sheet jasa: baris tanpa nomor yang punya Total sendiri (aksesoris, LED strip,
    // meter lari, ...) tetap masuk Jasa tukang, tapi tidak ikut Progres (hanya_jasa).
    const hanyaJasa =
      jasaSheet && !no && !!area && !takBernomor && !/^(sub ?)?total/i.test(rapi(r[1])) && (angka(c[7]) ?? 0) > 0;
    if (!NOMOR.test(no) && !kodeDiNo && !takBernomor && !hanyaJasa && !(tanpaNomor && !no && area)) continue;

    // Uraian: "Nama (KODE)" lalu spesifikasi di baris berikutnya dalam sel yang sama.
    const [kepala, ...sisa] = r[1].split(/\n|\s{3,}/).map(rapi).filter(Boolean);
    const spek = sisa.join(" ");
    const mk = kepala.match(/\(([^)]{1,12})\)/);
    const nama = rapi(mk ? kepala.replace(mk[0], " ") : kepala) || kepala;

    // Pekerjaan sipil sering menulis volume + satuan di kolom dimensi ("10 | titik").
    const [p, l, t, q] = [c[2], c[3], c[4], c[5]].map((x) => x || "");
    const satuanDiLebar = l && l !== "-" && bil(l) == null;
    const dims = [p, l, t].map(bil).filter((v) => v != null);
    if (tanpaNomor && (dims.length < 2 || /^(sub ?)?total/i.test(nama))) continue;

    const qty = satuanDiLebar ? (bil(p) ?? 1) * (bil(q) ?? 1) : bil(q) || 1;
    out.push({
      _baris: r._baris, // nomor baris Excel; hanya untuk memasangkan foto (pasangFoto)
      seksi, area,
      kode: kodeDiNo ? no.replace(/\s+/g, "").toUpperCase() : mk ? rapi(mk[1]) : null,
      nama,
      // Volume bersatuan (ls, titik, m2) = pekerjaan lapangan, bukan furnitur.
      jenis: satuanDiLebar || /sipil/i.test(seksi) ? "SIPIL" : tebakJenis(`${nama} ${spek}`),
      qty,
      satuan: satuanDiLebar ? l.toLowerCase() : "unit",
      dimensi: !satuanDiLebar && dims.length ? `${dims.map(tulis).join(" × ")} m` : null,
      harga: null,
      bobot: satuanDiLebar ? 1 : taksirBobot(dims, qty),
      // Hanya dipakai bacaJasa(): kolom Harga Satuan (G) & Total (H) Hitungan Jasa Pekerjaan.
      _jasa: { hs: angka(c[6]), total: angka(c[7]), tambahan: satuanDiLebar },
      ...(hanyaJasa ? { hanya_jasa: true } : {}),
    });
  }
  // Nama area cukup "Foyer"; bagiannya ikut ditulis hanya kalau nama yang sama
  // dipakai di lebih dari satu bagian (mis. Lantai 1 & Lantai 2 sama-sama
  // punya "Kamar Mandi").
  const seksiPerArea = {};
  for (const i of out) if (i.area) (seksiPerArea[i.area] ||= new Set()).add(i.seksi);
  return out.map(({ seksi, area, ...i }) => ({
    area: (seksiPerArea[area]?.size > 1 ? [seksi, area].filter(Boolean).join(" · ") : area || seksi) || "Umum",
    ...i,
  }));
}

function bacaLama(teks) {
  return teks.split(/\r?\n/)
    // Pemisah kolom: Tab (dari Excel). Kalau Tab berubah jadi spasi saat disalin, pakai 2+ spasi.
    .map((l) => (l.includes("\t") ? l.split("\t") : l.trim().split(/\s{2,}/)).map((x) => x.trim()))
    .filter((c) => c.length >= 3 && c[2] && !/^(uraian|nama)/i.test(c[2]))
    .map((c) => {
      const [area, kode, nama, jenis, qty, satuan, dimensi, harga, bobot] = c;
      const j = (jenis || "").toUpperCase();
      return {
        area: area || "Umum", kode: kode || null, nama,
        jenis: JENIS.includes(j) ? j : tebakJenis(`${jenis || ""} ${nama}`),
        qty: angka(qty) || 1, satuan: satuan || null, dimensi: dimensi || null,
        harga: angka(harga), bobot: angka(bobot) || 1,
      };
    });
}

// `mulai` = urutan item pertama (lanjutan dari item yang sudah ada).
export function bacaBoq(teks, mulai = 0) {
  const rows = bacaTsv(teks);
  const items = dariTemplate(rows) ? bacaTemplate(rows) : bacaLama(teks);
  return items.map(({ _jasa, ...i }, n) => ({ ...i, urutan: mulai + n }));
}

// Sama, tapi dari baris satu sheet file .xlsx (lihat lib/portal/bacaXlsx.js).
export const bacaBaris = (rows, mulai = 0) => bacaTemplate(rows).map(({ _jasa, ...i }, n) => ({ ...i, urutan: mulai + n }));

// Excel "Hitungan Jasa Pekerjaan" (satu sheet per tim tukang): kolom sama dengan
// BoQ sampai Qty, lalu Harga Satuan (G) dan Total (H). Hanya item bernomor;
// baris tambahan (Ambalan, LED strip, stopkontak, dan baris meter lari "ml")
// dilewati. Total diambil apa adanya dari kolom Total (rumusnya beda-beda).
export const bacaJasa = (rows) =>
  bacaTemplate(rows)
    .filter((i) => (!i._jasa.tambahan || i.hanya_jasa) && (i._jasa.total != null || i._jasa.hs != null))
    .map(({ area, kode, nama, qty, _jasa }) => ({ area, kode, nama, qty, harga_satuan: _jasa.hs, harga: _jasa.total }));

// Sheet Hitungan Jasa Pekerjaan sebagai item proyek baru: item bernomor saja
// (baris tambahan dilewati), lengkap dengan harga satuan, total, dan timnya.
export const bacaBarisJasa = (rows, tim, mulai = 0) =>
  bacaTemplate(rows)
    .filter((i) => !i._jasa.tambahan || i.hanya_jasa)
    .map(({ _jasa, ...i }, n) => ({ ...i, harga_satuan: _jasa.hs, harga: _jasa.total, tim: tim || null, urutan: mulai + n }));

// Kepala surat template: "Order No. | : 001416", "Nama | : Adriel M.", "Alamat | : ...".
export function infoSheet(rows) {
  const nilai = (re) => {
    const r = rows.find((x) => re.test(rapi(x[0])));
    // Tanggal BoQ sering satu baris dengan Order No. dan terbaca sebagai angka seri Excel (4xxxx).
    const v = r && r.slice(1).map((x) => rapi(x).replace(/^:\s*/, "")).find((x) => x && !/^[45]\d{4}$/.test(x));
    return (v || "").replace(/^-$/, "");
  };
  return { kode: nilai(/^order no/i), klien_nama: nilai(/^nama$/i), lokasi: nilai(/^alamat$/i), tim: nilai(/^team/i) };
}

// Pasangkan gambar kolom C (bacaXlsx.gambar) ke item: gambar milik item bernomor
// terdekat di atas atau sejajar barisnya (baris aksesoris di bawah item ikut
// item itu). Hasil: item dengan `_gambar` = [{ tipe, ambil }], maksimal
// MAKS_FOTO_ITEM per item. Item tanpa nomor baris (hasil tempel teks) tak punya foto.
export const MAKS_FOTO_ITEM = 5;
export function pasangFoto(items, gambar) {
  if (!gambar?.length) return items;
  const hasil = items.map((i) => ({ ...i, _gambar: [] }));
  for (const g of gambar) {
    let tujuan = null;
    for (const i of hasil) if (i._baris && i._baris <= g.baris && (!tujuan || i._baris > tujuan._baris)) tujuan = i;
    if (tujuan && tujuan._gambar.length < MAKS_FOTO_ITEM) tujuan._gambar.push(g);
  }
  return hasil;
}

// Satu sheet file .xlsx -> item proyek, dipakai impor proyek baru dan impor
// BOQ di proyek. Sheet Hitungan Jasa Pekerjaan (ada Harga Satuan & Total) ikut
// membawa harga, total, dan tim tukang; gambar kolom C dipasang ke itemnya.
export function bacaItemSheet(rows, mulai = 0, gambar = []) {
  const items = bacaJasa(rows).length ? bacaBarisJasa(rows, infoSheet(rows).tim, mulai) : bacaBaris(rows, mulai);
  return pasangFoto(items, gambar);
}
