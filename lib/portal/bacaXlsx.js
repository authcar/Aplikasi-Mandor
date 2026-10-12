// Pembaca .xlsx seperlunya untuk impor BOQ: daftar sheet + isi satu sheet
// sebagai teks. File BoQ Taraco berisi puluhan sheet dan gambar (50 MB lebih),
// jadi yang dibongkar dari zip hanya berkas XML yang dibutuhkan — gambar dan
// sheet lain tidak disentuh. Jalan di browser; file tidak dikirim ke server.
import { unzipSync, strFromU8 } from "fflate";

const KOLOM_MAKS = 12; // template hanya memakai A..G

const ENTITAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const teks = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] !== "#" ? ENTITAS[e] ?? m : String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  );
const atribut = (s, nama) => s.match(new RegExp(`(?:^|\\s)${nama}="([^"]*)"`))?.[1];
// Isi semua <t> (teks kaya terdiri dari beberapa potong); <rPh> = panduan baca, dibuang.
const isiT = (xml) =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => teks(m[1])).join("");

function kolom(ref) {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + c - 64;
  }
  return n - 1;
}

// Hasil rumus sering berekor panjang (5.0200000000000005).
const bilangan = (v) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 1e4) / 1e4) : v);

// buf = ArrayBuffer / Uint8Array isi file. Lempar Error kalau bukan .xlsx.
export function bukaXlsx(buf) {
  const zip = new Uint8Array(buf);
  const ambil = (nama) => {
    const f = unzipSync(zip, { filter: (x) => x.name === nama })[nama];
    return f ? strFromU8(f) : null;
  };

  const wb = ambil("xl/workbook.xml");
  const rels = ambil("xl/_rels/workbook.xml.rels");
  if (!wb || !rels) throw new Error("Bukan file Excel (.xlsx).");

  const target = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)>/g)) target[atribut(m[1], "Id")] = atribut(m[1], "Target");
  const berkas = {};
  for (const m of wb.matchAll(/<sheet\b([^>]*)>/g)) {
    if (/hidden/i.test(atribut(m[1], "state") || "")) continue;
    const t = target[atribut(m[1], "r:id")];
    if (t) berkas[teks(atribut(m[1], "name"))] = t.startsWith("/") ? t.slice(1) : `xl/${t}`;
  }

  let bersama; // teks bersama dibaca sekali, saat sheet pertama dibuka
  const teksBersama = () =>
    (bersama ||= [...(ambil("xl/sharedStrings.xml") || "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => isiT(m[1])));

  return {
    sheets: Object.keys(berkas),
    // -> [[sel, sel, ...], ...] hanya baris yang berisi; sel kosong = "".
    baca(nama) {
      const xml = ambil(berkas[nama]);
      if (!xml) return [];
      const rows = [];
      for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const row = Array(KOLOM_MAKS).fill("");
        let ada = false;
        for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const k = kolom(atribut(c[1], "r") || "");
          if (k < 0 || k >= KOLOM_MAKS || !c[2]) continue;
          const t = atribut(c[1], "t");
          const v = c[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
          let isi = "";
          if (t === "inlineStr") isi = isiT(c[2]);
          else if (v == null || t === "e" || t === "b") isi = "";
          else if (t === "s") isi = teksBersama()[Number(v)] ?? "";
          else if (t === "str") isi = teks(v);
          else isi = bilangan(v);
          if (isi) { row[k] = isi; ada = true; }
        }
        if (ada) rows.push(row);
      }
      return rows;
    },
  };
}
