// Klasifikasi tetap tabel Man Power di PDF Daily Progress (urutan = urutan baris).
export const KLASIFIKASI_MANPOWER = [
  "Tim Office",
  "Tim Kayu",
  "Tim Finishing",
  "Tim Sipil",
  "Tim Kaca/Cermin",
  "Tim Sofa",
  "Tim Lain-lain",
];

export const KOLOM_MANPOWER = [
  { key: "aktif_site", label: "Site" },
  { key: "aktif_ws", label: "Ws" },
  { key: "lembur", label: "Lembur" },
  { key: "alpha", label: "Alpha" },
];

const angka = (v) => (Number(v) > 0 ? Math.floor(Number(v)) : 0);

// Jumlah = Site + Ws + Lembur (Alpha tidak ikut), sama dengan hitungan di
// workflow n8n Daily Report.
export const jumlahManpower = (r) => angka(r?.aktif_site) + angka(r?.aktif_ws) + angka(r?.lembur);

// rows: baris laporan_manpower ({ klasifikasi, aktif_site, aktif_ws, lembur, alpha }).
// Return 7 baris tetap sesuai KLASIFIKASI_MANPOWER, nilai 0 untuk yang tidak ada.
export function susunManpower(rows = []) {
  const peta = new Map((rows || []).map((r) => [r.klasifikasi, r]));
  return KLASIFIKASI_MANPOWER.map((nama) => {
    const r = peta.get(nama) || {};
    return {
      nama,
      aktif_site: angka(r.aktif_site),
      aktif_ws: angka(r.aktif_ws),
      lembur: angka(r.lembur),
      alpha: angka(r.alpha),
      jumlah: jumlahManpower(r),
    };
  });
}
