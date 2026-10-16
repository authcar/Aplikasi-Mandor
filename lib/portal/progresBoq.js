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

// Bobot tahap khusus item tidak harus berjumlah 100: progres dihitung dari
// perbandingannya. skala = pengali supaya total bobot item jadi 100.
const skala = (item) => {
  const total = tahapItem(item).reduce((a, s) => a + s.w, 0);
  return total > 0 ? 100 / total : 0;
};

// item.progres = { [tahap]: "YYYY-MM-DD" } (tanggal terakhir dicatat) dan
// item.porsi = { [tahap]: 1..100 } (seberapa jauh tahap itu dikerjakan).
// Tahap tercatat tanpa porsi (data sebelum kolom persen ada) = 100.
// `sampai` opsional (inklusif): hanya tahap yang tercatat sampai tanggal itu.
export const persenTahap = (item, s, sampai) => {
  const d = item.progres?.[s.k];
  return d && (!sampai || d <= sampai) ? Number(item.porsi?.[s.k] ?? 100) : 0;
};
export const tahapSelesai = (item, s) => persenTahap(item, s) >= 100;

// Bobot boleh pecahan (12,5), jadi hasilnya dibulatkan 2 desimal.
export const persenItem = (item, sampai) =>
  Math.round(
    tahapItem(item).reduce((a, s) => a + (s.w * persenTahap(item, s, sampai)) / 100, 0) * skala(item) * 100
  ) / 100;

// Penimbang progres antar item: nilai rupiah atau bobot.
// `pilih` = portal_proyek.timbang_harga, pilihan admin di tab Item BOQ. Harga
// baru dipakai kalau admin memilihnya DAN semua item sudah berharga; selain
// itu bobot. `pilih` kosong = kolomnya belum ada (supabase/
// add_portal_pembayaran.sql belum dijalankan) -> cara lama: otomatis.
export const semuaBerharga = (items) => items.length > 0 && items.every((i) => Number(i.harga) > 0);
export const pakaiHarga = (items, pilih) => (pilih ?? true) && semuaBerharga(items);

// Tempel `berat` di tiap item SATU proyek (dipanggil loader di lib/portal/),
// supaya hitungan per area memakai penimbang yang sama dengan proyeknya.
export const beriBerat = (items, pilih) => {
  const h = pakaiHarga(items, pilih);
  return items.map((i) => ({ ...i, berat: h ? Number(i.harga) : Number(i.bobot) || 1 }));
};
const berat = (i) => Number(i.berat) || Number(i.bobot) || 1;

// Area "Lain-lain" (proteksi, cat pasca renovasi, tarik listrik, dll.) tidak
// ditampilkan dan tidak dihitung di progres. Itemnya tetap ada di BOQ dan
// rincian harga.
export const areaProgres = (area) => !/^lain[\s-]*lain$/i.test(String(area || "").trim());
const ikut = (items) => items.filter((i) => areaProgres(i.area));

export const persenProyek = (items, sampai) => {
  items = ikut(items);
  if (!items.length) return 0;
  const w = berat;
  const total = items.reduce((a, i) => a + w(i), 0) || 1;
  return items.reduce((a, i) => a + w(i) * persenItem(i, sampai), 0) / total;
};

// Kontribusi tiap fase ke progres proyek (0..100 dari total proyek).
export const persenFase = (items, faseKey, sampai) => {
  items = ikut(items);
  if (!items.length) return 0;
  const w = berat;
  const total = items.reduce((a, i) => a + w(i), 0) || 1;
  return (
    items.reduce((a, i) => {
      const p = tahapItem(i)
        .filter((s) => s.fase === faseKey)
        .reduce((b, s) => b + (s.w * persenTahap(i, s, sampai)) / 100, 0);
      return a + w(i) * p * skala(i);
    }, 0) / total
  );
};

// Bobot maksimum fase (rata-rata tertimbang dari template tiap item).
export const bobotFase = (items, faseKey) => {
  items = ikut(items);
  if (!items.length) return 0;
  const w = berat;
  const total = items.reduce((a, i) => a + w(i), 0) || 1;
  return (
    items.reduce(
      (a, i) => a + w(i) * skala(i) * tahapItem(i).filter((s) => s.fase === faseKey).reduce((b, s) => b + s.w, 0),
      0
    ) / total
  );
};

// Semua tahap selain retensi sudah selesai di semua item (tahap berbobot 0
// tidak dihitung). Dipakai untuk status "Masa retensi", berapa pun bobot retensinya.
export const tinggalRetensi = (items) =>
  ikut(items).length > 0 && ikut(items).every((i) => tahapItem(i).every((s) => s.fase === "retensi" || !s.w || tahapSelesai(i, s)));

export const tahapTerakhir = (item) => {
  let best = null;
  for (const s of tahapItem(item)) {
    const d = item.progres?.[s.k];
    if (d && (!best || d >= best.tgl)) best = { ...s, tgl: d };
  }
  return best;
};

// Fase berurutan: produksi -> pengiriman -> instalasi -> retensi. Tahap suatu
// fase baru boleh dicatat setelah semua tahap (yang berbobot) di fase-fase
// sebelumnya selesai 100%. Fase yang tidak dimiliki jenis itu (mis. Sipil tanpa
// produksi) dianggap selesai.
const urutFase = (k) => FASE.findIndex((f) => f.k === k);
export const faseSelesai = (item, faseKey) =>
  tahapItem(item).every((s) => s.fase !== faseKey || !s.w || tahapSelesai(item, s));
// Fase pertama yang belum selesai dan menghalangi fase `faseKey`, atau null.
export const faseMenghalangi = (item, faseKey) =>
  FASE.slice(0, urutFase(faseKey)).find((f) => !faseSelesai(item, f.k)) || null;
export const faseTerkunci = (item, faseKey) => !!faseMenghalangi(item, faseKey);
export const tahapTerkunci = (item, s) => faseTerkunci(item, s.fase);

// Tahap pertama yang belum selesai 100%, atau null kalau semua selesai.
export const tahapBerikut = (item) => tahapItem(item).find((s) => !tahapSelesai(item, s)) || null;

// Urutan potongan bar progres: tahap yang sudah selesai di depan (urut tanggal
// selesai), lalu yang belum, supaya bar terisi dari kiri berapa pun urutan
// tahap dicentang. Tanggal sama -> urutan tahap.
export const tahapBar = (item) => {
  const tahap = tahapItem(item);
  const tgl = (s) => item.progres?.[s.k] || "";
  return [...tahap.filter(tgl).sort((a, b) => tgl(a).localeCompare(tgl(b))), ...tahap.filter((s) => !tgl(s))];
};

// Tebak jenis dari teks spesifikasi BOQ produksi.
export const tebakJenis = (teks = "") => {
  const s = teks.toLowerCase();
  if (/duco|fin\.? ?cat|finish cat|coating/.test(s)) return "DUCO";
  if (/pengecatan|penyerutan|bongkar|plester|keramik|sipil/.test(s)) return "SIPIL";
  if (/hpl|plywood|melamin|multiplek/.test(s)) return "HPL";
  if (/vendor|kaca|cermin|granit|top table|mirror/.test(s)) return "VENDOR";
  return "HPL";
};

// Fase yang sedang berjalan: fase pertama (urutan FASE) yang masih punya tahap
// belum selesai 100%. Bar progres item cukup menampilkan fase ini; begitu semua
// tahap produksi selesai, yang tampil fase pengiriman, dst. null = semua selesai.
// persen = progres di dalam fase itu (0..100), termasuk tahap yang baru sebagian.
export const faseKini = (item) => {
  const tahap = tahapItem(item).filter((s) => s.w > 0);
  for (const f of FASE) {
    const st = tahap.filter((s) => s.fase === f.k);
    if (st.every((s) => tahapSelesai(item, s))) continue;
    const total = st.reduce((a, s) => a + s.w, 0);
    const selesai = st.reduce((a, s) => a + (s.w * persenTahap(item, s)) / 100, 0);
    return { ...f, tahap: st, persen: (selesai / total) * 100 };
  }
  return null;
};
