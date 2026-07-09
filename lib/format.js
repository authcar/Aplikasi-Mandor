export const rupiah = (n) =>
  "Rp " + Number(n || 0).toLocaleString("id-ID");

export const tglID = (d) =>
  new Date(d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

// Kelompokkan baris absensi_tim (sudah terurut tanggal desc, urutan asc)
// jadi per-hari > per-tim, sama seperti grouping di AbsensiTimForm.
export function groupAbsensiTimPerHari(rows) {
  const hari = [];
  for (const r of rows || []) {
    let h = hari[hari.length - 1];
    if (!h || h.tanggal !== r.tanggal) {
      h = { tanggal: r.tanggal, tims: [] };
      hari.push(h);
    }
    const lastTim = h.tims[h.tims.length - 1];
    const line = { jumlah: r.jumlah, kegiatan: r.kegiatan };
    if (lastTim && lastTim.nama === r.tim) lastTim.lines.push(line);
    else h.tims.push({ nama: r.tim, lines: [line] });
  }
  return hari;
}

export const tglLaporanID = (d) =>
  new Date(d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

// Format teks laporan absensi harian, sama seperti preview di form.
export function laporanTeks(tanggal, tims) {
  let out = `Absensi Harian Tukang\n${tglLaporanID(tanggal)}\n`;
  for (const t of tims) {
    out += `\n${t.nama}\n`;
    for (const l of t.lines) {
      const j = Number(l.jumlah);
      out += j > 0 ? `- ${j} orang ${l.kegiatan}\n` : `- ${l.kegiatan}\n`;
    }
  }
  return out.trimEnd();
}

export const totalOrangTim = (tims) =>
  (tims || []).reduce(
    (s, t) =>
      s + t.lines.reduce((ss, l) => ss + (Number(l.jumlah) > 0 ? Number(l.jumlah) : 1), 0),
    0
  );
