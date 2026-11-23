import { zipSync, strToU8 } from "fflate";

// Membuat file Excel (.xlsx) daftar BoQ satu proyek portal, tanpa library tambahan:
// .xlsx hanyalah zip berisi XML. Kolom mengikuti template BoQ Taraco (No | Uraian | ...),
// item dikelompokkan per area (A, B, C ...). Server-only.
//
// data: { proyek, lokasi, kode, items: [{ area, kode, nama, jenis, qty, satuan, dimensi, tim, harga_satuan, harga }], denganHarga }
// Return Uint8Array.

const huruf = (i) => (i >= 26 ? huruf(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));
const esc = (s) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Gaya (indeks cellXfs di styles.xml)
const S = { biasa: 0, tebal: 1, kepala: 2, angka: 3, judul: 4, tengah: 5, tebalArea: 6 };

export function buatXlsxBoq({ proyek, lokasi, kode, items, denganHarga = false }) {
  const kolom = [
    ["NO", 6], ["KODE", 10], ["URAIAN", 44], ["JENIS", 10], ["DIMENSI", 24], ["QTY", 9], ["SATUAN", 10], ["TIM", 16],
    ...(denganHarga ? [["HARGA SATUAN JASA", 18], ["TOTAL JASA", 18]] : []),
  ];
  const baris = []; // tiap baris: array sel { v, s, n } (n = angka)
  const sel = (v, s = S.biasa) => ({ v, s });
  const angka = (v, s = S.angka) => ({ v: Number(v), s, n: true });

  baris.push([sel(`BILL OF QUANTITY (BoQ) - ${proyek || ""}`, S.judul)]);
  baris.push([sel([kode, lokasi].filter(Boolean).join(" · "), S.biasa)]);
  baris.push([]);
  baris.push(kolom.map(([k]) => sel(k, S.kepala)));

  // Kelompok per area, urutan kemunculan pertama (sama dengan PDF laporan).
  const area = [];
  for (const it of items) {
    const nama = String(it.area || "").trim() || "Umum";
    let g = area.find((a) => a.nama === nama);
    if (!g) area.push((g = { nama, item: [] }));
    g.item.push(it);
  }
  area.forEach((g, ai) => {
    baris.push([sel(huruf(ai), S.tengah), sel(""), sel(g.nama.toUpperCase(), S.tebalArea)]);
    g.item.forEach((it, i) => {
      const r = [
        { v: i + 1, s: S.tengah, n: true },
        sel(it.kode || ""),
        sel(it.nama || ""),
        sel(it.jenis || ""),
        sel(it.dimensi || ""),
        it.qty != null && it.qty !== "" ? angka(it.qty, S.biasa) : sel(""),
        sel(it.satuan || ""),
        sel(it.tim || ""),
      ];
      if (denganHarga) {
        r.push(it.harga_satuan != null ? angka(it.harga_satuan) : sel(""));
        r.push(it.harga != null ? angka(it.harga) : sel(""));
      }
      baris.push(r);
    });
  });
  if (denganHarga && items.length) {
    const t = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
    const kosong = Array(kolom.length - 2).fill(null).map((_, i) => sel(i === 2 ? "TOTAL" : "", S.tebal));
    baris.push([...kosong, sel("", S.tebal), angka(t)]);
  }

  const xmlBaris = baris
    .map((r, ri) => {
      const sel_ = r
        .map((c, ci) => {
          if (c == null) return "";
          const ref = `${huruf(ci)}${ri + 1}`;
          if (c.n) return `<c r="${ref}" s="${c.s}"><v>${c.v}</v></c>`;
          if (c.v === "") return c.s ? `<c r="${ref}" s="${c.s}"/>` : "";
          return `<c r="${ref}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${sel_}</row>`;
    })
    .join("");

  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${kolom.map(([, w], i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${xmlBaris}</sheetData></worksheet>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>` +
    `<fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font></fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill></fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="7">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const NS = "http://schemas.openxmlformats.org/";
  const files = {
    "[Content_Types].xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS}package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${NS}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS}officeDocument/2006/relationships">` +
      `<sheets><sheet name="BoQ" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${NS}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${NS}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheet,
    "xl/styles.xml": styles,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}
