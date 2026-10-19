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

// Target relasi ("../drawings/drawing3.xml", "/xl/media/a.png") -> nama berkas di zip.
function jalur(dasar, target) {
  if (target.startsWith("/")) return target.slice(1);
  const bagian = dasar.split("/").slice(0, -1);
  for (const b of target.split("/")) {
    if (b === "..") bagian.pop();
    else if (b !== ".") bagian.push(b);
  }
  return bagian.join("/");
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

  // Gambar yang menempel di kolom C satu sheet (foto contoh item di template
  // BoQ): [{ baris, tipe, ambil() }] urut dari atas. baris = nomor baris Excel
  // (1, 2, …) tempat pojok kiri atas gambar berada; ambil() membongkar
  // gambarnya dari zip baru saat dibutuhkan (file BoQ bisa puluhan MB).
  function gambarSheet(nama) {
    const rel = ambil(berkas[nama].replace(/([^/]+)$/, "_rels/$1.rels"));
    const sasaranGambar = rel && [...rel.matchAll(/<Relationship\b([^>]*)>/g)].map((m) => atribut(m[1], "Target")).find((t) => /drawing/i.test(t || ""));
    if (!sasaranGambar) return [];
    const berkasGambar = jalur(berkas[nama], sasaranGambar);
    const xml = ambil(berkasGambar);
    const relGambar = ambil(berkasGambar.replace(/([^/]+)$/, "_rels/$1.rels"));
    if (!xml || !relGambar) return [];
    const media = {};
    for (const m of relGambar.matchAll(/<Relationship\b([^>]*)>/g)) media[atribut(m[1], "Id")] = jalur(berkasGambar, atribut(m[1], "Target"));

    const out = [];
    for (const a of xml.matchAll(/<(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)[\s\S]*?<\/(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)>/g)) {
      const dari = a[0].match(/<(?:\w+:)?from>[\s\S]*?<(?:\w+:)?col>(\d+)<[\s\S]*?<(?:\w+:)?row>(\d+)</);
      const id = a[0].match(/r:embed="([^"]+)"/)?.[1];
      const berkasMedia = media[id];
      if (!dari || !berkasMedia || Number(dari[1]) !== 2) continue; // hanya kolom C
      out.push({
        baris: Number(dari[2]) + 1,
        tipe: /\.jpe?g$/i.test(berkasMedia) ? "image/jpeg" : /\.png$/i.test(berkasMedia) ? "image/png" : /\.gif$/i.test(berkasMedia) ? "image/gif" : /\.webp$/i.test(berkasMedia) ? "image/webp" : "",
        ambil: () => unzipSync(zip, { filter: (x) => x.name === berkasMedia })[berkasMedia],
      });
    }
    return out.filter((g) => g.tipe).sort((x, y) => x.baris - y.baris);
  }

  return {
    sheets: Object.keys(berkas),
    gambar(nama) {
      try {
        return berkas[nama] ? gambarSheet(nama) : [];
      } catch {
        return [];
      }
    },
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
        if (ada) {
          row._baris = Number(atribut(r[0].match(/<row\b[^>]*>/)[0], "r")) || 0; // nomor baris Excel
          rows.push(row);
        }
      }
      return rows;
    },
  };
}
