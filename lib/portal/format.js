import { persenProyek } from "./progresBoq";

export const hariIni = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
export const tambahHari = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const selisihHari = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const tgl = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}`;
};
export const tglTh = (s) => `${tgl(s)} ${s.slice(0, 4)}`;
export const rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
export const pct = (n) => (Math.round(n * 10) / 10).toLocaleString("id-ID") + "%";

// Nilai kontrak = jumlah harga item. 0 kalau harga belum diisi.
export const nilaiKontrak = (P) => P.items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
export const persenLunas = (P) => P.termin.filter((t) => t.lunas_tgl).reduce((a, t) => a + Number(t.persen), 0);

export function statusProyek(P) {
  const p = persenProyek(P.items);
  if (!P.items.length) return ["Persiapan", "b-n"];
  if (p >= 100) return ["Selesai", "b-ok"];
  if (p >= 95) return ["Masa retensi", "b-ok"];
  if (!P.deadline) return ["Berjalan", "b-n"];
  const now = hariIni();
  if (now > P.deadline) return ["Lewat deadline", "b-bad"];
  const span = Math.max(1, selisihHari(P.mulai, P.deadline));
  const harapan = Math.min(100, Math.max(0, (selisihHari(P.mulai, now) / span) * 100));
  return p >= harapan - 10 ? ["Sesuai jadwal", "b-ok"] : ["Perlu dikejar", "b-warn"];
}

// "1.250.000" / "1.250.000,5" / "12,5" / "Rp 4.500.000" -> angka. null kalau kosong.
export const angka = (s) => {
  s = String(s ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
};
