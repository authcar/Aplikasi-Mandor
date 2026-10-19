import { persenProyek, tinggalRetensi } from "./progresBoq";

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

// Deadline hanya diisi sekali. Sesudah hari deadline lewat, proyek terkunci:
// semua aksi ditolak (lihat cekTerbuka di app/(portal)/portal/aksi.js).
export const lewatDeadline = (P) => !!P.deadline && hariIni() > P.deadline;

// Label sisa waktu ke deadline: [teks, kelas badge]. Merah <= 3 hari atau
// sudah lewat, kuning <= 7 hari.
export function labelDeadline(deadline) {
  const n = selisihHari(hariIni(), deadline);
  if (n < 0) return [`Lewat ${-n} hari`, "b-bad"];
  if (n === 0) return ["Deadline hari ini", "b-bad"];
  return [`${n} hari lagi`, n <= 3 ? "b-bad" : n <= 7 ? "b-warn" : "b-n"];
}

// Nilai kontrak = jumlah harga item. 0 kalau harga belum diisi.
export const nilaiKontrak = (P) => P.items.reduce((a, i) => a + (Number(i.harga) || 0), 0);

// Termin dihitung dari nilai proyek (portal_proyek.nilai_proyek, diisi admin di
// tab Termin), TERPISAH dari nilai jasa tukang per item. Jasa perancangan sudah
// dihapus: kolom nilai_perancangan dan termin berjenis lain diabaikan.
// `nilai` tetap berbentuk { [jenis]: rupiah }.
export const JENIS_TERMIN = [["produksi", "Jasa produksi"]];
export const jenisTermin = (t) => t.jenis || "produksi";
export const nilaiTermin = (P) => ({ produksi: Number(P.nilai_proyek) || 0 });
export const totalNilai = (nilai) => nilai.produksi;

// Pola termin standar Taraco: DP, saat progres 50%, pelunasan.
// Isinya [keterangan, persen]; judul "Termin n" dibuat otomatis (judulTermin).
export const terminStandar = () => [["DP", 50], ["Saat progres 50%", 40], ["Pelunasan", 10]];

// Judul termin otomatis dari urutannya di dalam jenisnya: Termin 1, 2, 3, ...
// Kolom `label` dipakai sebagai keterangan (DP, saat progres 50%, ...); label
// lama berbentuk "Termin 1 · DP" dibuang awalan "Termin n".
export const judulTermin = (n) => `Termin ${n + 1}`;
export const keteranganTermin = (t) => String(t.label || "").replace(/^termin\s*\d+\s*(·\s*)?/i, "").trim();

// Pembayaran termin. `nilai` = nilaiTermin(P). `dibayar` = nominal yang
// benar-benar diterima (boleh sebagian), dikunci saat termin ditandai lunas
// supaya tidak ikut berubah kalau harga diubah belakangan. Termin lunas tanpa
// nominal (data lama, atau harga belum diisi saat dilunasi) masih dihitung
// dari persennya.
export const tagihanTermin = (t, nilai) => Math.round(((nilai[jenisTermin(t)] || 0) * Number(t.persen)) / 100);
export const dibayarTermin = (t, nilai) =>
  t.dibayar != null ? Number(t.dibayar) : t.lunas_tgl ? tagihanTermin(t, nilai) : 0;
export const totalDibayar = (termin, nilai) => termin.reduce((a, t) => a + dibayarTermin(t, nilai), 0);

// Status defect dari klien (portal_defect.status): [label, kelas badge].
// DITUTUP hanya untuk defect yang tersambung ke Defect List Mandor (item dibatalkan di sana).
// Fitur Defect list di Project Tracker (tab Defect staf & klien, lencana "defect
// baru", kirim laporan). Untuk sementara dimatikan; ubah ke true untuk
// mengaktifkan lagi. Data portal_defect tetap ada.
export const DEFECT_AKTIF = false;
export const STATUS_DEFECT = { BARU: ["Baru", "b-warn"], DIPROSES: ["Diproses", "b-n"], SELESAI: ["Selesai", "b-ok"], DITUTUP: ["Ditutup", "b-n"] };

// Angka progres di link klien = progres asli + persiapan & material (ditulis
// terbuka di halaman klien). Belum mulai tetap 0%, dan baru 100% kalau
// pekerjaannya benar-benar selesai (sebelum itu paling tinggi 99%).
// Status proyek (statusProyek) tetap dari progres asli.
export const SPREAD_KLIEN = 10;
export const persenKlien = (p) => (p <= 0 ? 0 : p >= 99.995 ? 100 : Math.min(99, p + SPREAD_KLIEN));

export function statusProyek(P) {
  const p = persenProyek(P.items);
  if (!P.items.length) return ["Persiapan", "b-n"];
  if (p >= 99.995) return ["Selesai", "b-ok"];
  if (tinggalRetensi(P.items)) return ["Masa retensi", "b-ok"];
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
