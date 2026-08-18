export const rupiah = (n) =>
  "Rp " + Number(n || 0).toLocaleString("id-ID");

// Label deadline proyek: tanggal + selisih hari, warna makin mendesak
// makin dekat/lewat. `deadline` null (belum diisi di Taraco) -> null.
// Dipakai di dashboard Supervisor/Master/Mandor (lihat ProyekSayaCard).
export const labelDeadlineProyek = (deadline) => {
  if (!deadline) return null;
  const target = new Date(`${deadline}T00:00:00`);
  const today = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
  );
  const sisaHari = Math.round((target - today) / 86400000);
  const tanggal = target.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (sisaHari < 0) {
    return { teks: `${tanggal} · telat ${Math.abs(sisaHari)} hari`, cls: "bg-red-100 text-red-600" };
  }
  if (sisaHari === 0) {
    return { teks: `${tanggal} · hari ini`, cls: "bg-red-100 text-red-600" };
  }
  if (sisaHari <= 3) {
    return { teks: `${tanggal} · H-${sisaHari}`, cls: "bg-amber-100 text-amber-600" };
  }
  return { teks: tanggal, cls: "bg-gray-100 text-gray-500" };
};

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

// Durasi kunjungan Supervisor (app/supervisor/kunjungan, app/master/kunjungan).
// Dipakai buat dua hal: durasi satu kunjungan, dan total durasi sebulan —
// makanya menerima menit, bukan pasangan tanggal.
export const durasiTeks = (menit) => {
  if (!Number.isFinite(menit) || menit < 0) return "—";
  const jam = Math.floor(menit / 60);
  const sisa = Math.round(menit % 60);
  if (jam === 0) return `${sisa}m`;
  return sisa === 0 ? `${jam}j` : `${jam}j ${sisa}m`;
};

// Menit antara dua timestamp; null kalau kunjungan belum ditutup.
export const menitKunjungan = (mulai, selesai) =>
  mulai && selesai ? (new Date(selesai) - new Date(mulai)) / 60000 : null;

// Jam:menit WIB dari timestamptz.
export const jamWIB = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      })
    : "--:--";
