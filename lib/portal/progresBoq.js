// Tahap pekerjaan per jenis item BOQ + hitungan progres.
// Dipakai halaman admin (centang tahap) dan halaman klien, jadi angkanya selalu sama.

export const FASE = [
  { k: "produksi", label: "Produksi" },
  { k: "pengiriman", label: "Pengiriman" },
  { k: "instalasi", label: "Instalasi" },
  { k: "retensi", label: "Retensi" },
];

const EKOR = [
  ["kirim", "Kirim", 5, "pengiriman"],
  ["instal", "Instal", 10, "instalasi"],
  ["finishing", "Finishing", 10, "instalasi"],
  ["setting", "Setting", 5, "instalasi"],
  ["cleaning", "Cleaning", 5, "instalasi"],
  ["retensi", "Retensi", 5, "retensi"],
];

const t = (rows) => rows.map(([k, label, w, fase]) => ({ k, label, w, fase }));

// Bobot BAWAAN tiap jenis, berjumlah 100. Admin bisa mengubahnya per jenis di
// /portal/bobot; hasilnya menempel di tiap item sebagai item.bobot_tahap
// (lihat ambilItem di lib/portal/data.js) dan dipakai lewat tahapItem().
export const TAHAP = {
  HPL: t([
    ["potong", "Potong", 10, "produksi"],
    ["pasang_hpl", "Pasang HPL", 15, "produksi"],
    ["rakit", "Rakit", 20, "produksi"],
    ["tusir", "Tusir", 5, "produksi"],
    ["rakit_11", "Rakit 1:1", 10, "produksi"],
    ...EKOR,
  ]),
  DUCO: t([
    ["potong", "Potong", 10, "produksi"],
    ["rakit", "Rakit", 15, "produksi"],
    ["sampolac", "Sampolac", 5, "produksi"],
    ["cat_1", "Cat 1", 10, "produksi"],
    ["cat_2", "Cat 2", 10, "produksi"],
    ["cat_3", "Cat 3", 10, "produksi"],
    ...EKOR,
  ]),
  VENDOR: t([
    ["pesan", "Dipesan", 20, "produksi"],
    ["produksi_vendor", "Produksi vendor", 40, "produksi"],
    ["datang", "Barang datang", 10, "pengiriman"],
    ["pasang", "Terpasang", 25, "instalasi"],
    ["retensi", "Retensi", 5, "retensi"],
  ]),
  SIPIL: t([
    ["mulai", "Mulai", 30, "instalasi"],
    ["selesai", "Selesai", 65, "instalasi"],
    ["retensi", "Retensi", 5, "retensi"],
  ]),
};

export const JENIS = Object.keys(TAHAP);
export const JENIS_LABEL = { HPL: "HPL", DUCO: "Duco / Cat", VENDOR: "Vendor", SIPIL: "Sipil" };

export const tahapItem = (item) => {
  const bawaan = TAHAP[item.jenis] || TAHAP.HPL;
  const b = item.bobot_tahap;
  return b ? bawaan.map((s) => ({ ...s, w: Number(b[s.k] ?? s.w) })) : bawaan;
};

// item.progres = { [tahap]: "YYYY-MM-DD" }. `sampai` opsional (inklusif).
// Bobot boleh pecahan (12,5), jadi jumlahnya dibulatkan 2 desimal.
export const persenItem = (item, sampai) =>
  Math.round(
    tahapItem(item).reduce((a, s) => {
      const d = item.progres?.[s.k];
      return a + (d && (!sampai || d <= sampai) ? s.w : 0);
    }, 0) * 100
  ) / 100;

// Pakai nilai rupiah kalau SEMUA item sudah ada harga; selain itu pakai bobot.
export const pakaiHarga = (items) => items.length > 0 && items.every((i) => Number(i.harga) > 0);
const beratFn = (items) =>
  pakaiHarga(items) ? (i) => Number(i.harga) : (i) => Number(i.bobot) || 1;

export const persenProyek = (items, sampai) => {
  if (!items.length) return 0;
  const w = beratFn(items);
  const total = items.reduce((a, i) => a + w(i), 0) || 1;
  return items.reduce((a, i) => a + w(i) * persenItem(i, sampai), 0) / total;
};

// Kontribusi tiap fase ke progres proyek (0..100 dari total proyek).
export const persenFase = (items, faseKey, sampai) => {
  if (!items.length) return 0;
  const w = beratFn(items);
  const total = items.reduce((a, i) => a + w(i), 0) || 1;
  return (
    items.reduce((a, i) => {
      const p = tahapItem(i)
        .filter((s) => s.fase === faseKey && i.progres?.[s.k] && (!sampai || i.progres[s.k] <= sampai))
        .reduce((b, s) => b + s.w, 0);
      return a + w(i) * p;
    }, 0) / total
  );
};

// Bobot maksimum fase (rata-rata tertimbang dari template tiap item).
export const bobotFase = (items, faseKey) => {
  if (!items.length) return 0;
  const w = beratFn(items);
  const total = items.reduce((a, i) => a + w(i), 0) || 1;
  return (
    items.reduce(
      (a, i) => a + w(i) * tahapItem(i).filter((s) => s.fase === faseKey).reduce((b, s) => b + s.w, 0),
      0
    ) / total
  );
};

export const tahapTerakhir = (item) => {
  let best = null;
  for (const s of tahapItem(item)) {
    const d = item.progres?.[s.k];
    if (d && (!best || d >= best.tgl)) best = { ...s, tgl: d };
  }
  return best;
};

export const tahapBerikut = (item) => tahapItem(item).find((s) => !item.progres?.[s.k]) || null;

// Tebak jenis dari teks spesifikasi BOQ produksi.
export const tebakJenis = (teks = "") => {
  const s = teks.toLowerCase();
  if (/duco|fin\.? ?cat|finish cat|coating/.test(s)) return "DUCO";
  if (/pengecatan|penyerutan|bongkar|plester|keramik|sipil/.test(s)) return "SIPIL";
  if (/hpl|plywood|melamin|multiplek/.test(s)) return "HPL";
  if (/vendor|kaca|cermin|granit|top table|mirror/.test(s)) return "VENDOR";
  return "HPL";
};
