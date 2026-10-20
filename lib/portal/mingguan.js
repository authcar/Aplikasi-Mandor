// Laporan mingguan: progres sebelum/sesudah tiap 7 hari, tahap yang dikerjakan,
// dan upah jasa tukang per tim. Fungsi murni (dipakai di browser) di atas
// riwayat perubahan progres (lib/portal/riwayat.js).
//
// Minggu = blok 7 hari berurutan sejak proyek dimulai (minggu 1 = hari mulai
// s.d. +6, dst.), bukan minggu kalender. Minggu yang masih berjalan dihitung
// sampai hari ini dan terus berubah sampai hari ke-7.
import { persenProyek, persenItem, persenTahap, tahapItem, itemProgres, berat, skala } from "./progresBoq";
import { tambahHari, selisihHari } from "./format";

const MAKS_MINGGU = 104;

// riwayat = [{ item_id, tahap, persen, tgl, at }] -> { [item_id]: { [tahap]: [urut lama -> baru] } }
export function indeksRiwayat(riwayat) {
  const idx = {};
  for (const r of riwayat) ((idx[r.item_id] ||= {})[r.tahap] ||= []).push(r);
  for (const per of Object.values(idx))
    for (const daftar of Object.values(per)) daftar.sort((a, b) => a.tgl.localeCompare(b.tgl) || String(a.at).localeCompare(String(b.at)));
  return idx;
}

// Item dengan progres/porsi sebagaimana keadaannya pada akhir hari `sampai`.
// Tahap yang tidak punya riwayat (data sebelum riwayat dicatat) memakai
// keadaan terakhirnya, bertanggal selesai_tgl.
export function keadaanSampai(item, idx, sampai) {
  const per = idx[item.id] || {};
  const progres = {}, porsi = {};
  for (const s of tahapItem(item)) {
    let daftar = per[s.k];
    if (!daftar) {
      const d = item.progres?.[s.k];
      daftar = d ? [{ tgl: d, persen: Number(item.porsi?.[s.k] ?? 100) }] : [];
    }
    let akhir = null;
    for (const e of daftar) if (e.tgl <= sampai) akhir = e;
    if (akhir && akhir.persen > 0) {
      progres[s.k] = akhir.tgl;
      porsi[s.k] = akhir.persen;
    }
  }
  return { ...item, progres, porsi };
}

// Tanggal paling awal ada progres (atau mulai proyek, mana yang lebih dulu).
function awalProyek(proyek, items, riwayat) {
  let awal = proyek.mulai || null;
  const cek = (d) => d && (!awal || d < awal) && (awal = d);
  for (const r of riwayat) cek(r.tgl);
  for (const i of items) for (const d of Object.values(i.progres || {})) cek(d);
  return awal;
}

// [{ no, mulai, akhir, berjalan }] dari minggu 1 sampai minggu yang memuat `hari`
// (paling banyak MAKS_MINGGU minggu terakhir).
export function daftarMinggu(proyek, items, riwayat, hari) {
  const awal = awalProyek(proyek, items, riwayat) || hari;
  const semua = Math.max(1, Math.floor(selisihHari(awal, hari) / 7) + 1);
  const dari = Math.max(0, semua - MAKS_MINGGU);
  return Array.from({ length: semua - dari }, (_, k) => {
    const mulai = tambahHari(awal, (dari + k) * 7);
    const akhir = tambahHari(mulai, 6);
    return { no: dari + k + 1, mulai, akhir, berjalan: hari >= mulai && hari <= akhir };
  });
}

// Hasil satu minggu.
//  idx = indeksRiwayat(riwayat).
//  - sebelum/sesudah/naik: progres proyek (poin persen 0..100) di awal & akhir minggu.
//  - tahap: tahap yang dikerjakan, [{ label, poin, bagian }]; poin = sumbangan ke
//    progres proyek, bagian = porsinya (%) dari seluruh kemajuan minggu itu.
//  - tim: upah jasa tukang per tim (hanya bermakna kalau item membawa `harga`).
//    upah item = kenaikan % progres itemnya x total jasa tukang item itu; tanpa
//    progres berarti 0. Koreksi turun menghasilkan angka negatif.
export function hitungMinggu(items, idx, minggu, hari) {
  const dasar = items.filter(itemProgres);
  const sampai = minggu.akhir > hari ? hari : minggu.akhir;
  const awal = dasar.map((i) => keadaanSampai(i, idx, tambahHari(minggu.mulai, -1)));
  const akhir = dasar.map((i) => keadaanSampai(i, idx, sampai));
  const total = dasar.reduce((a, i) => a + berat(i), 0) || 1;

  const poinTahap = new Map();
  const tim = new Map();
  dasar.forEach((i, k) => {
    for (const s of tahapItem(i)) {
      const d = persenTahap(akhir[k], s) - persenTahap(awal[k], s);
      if (d > 0) poinTahap.set(s.label, (poinTahap.get(s.label) || 0) + ((berat(i) / total) * skala(i) * s.w * d) / 100);
    }
    const nama = i.tim?.trim() || "Belum ada tim";
    const t = tim.get(nama) || { tim: nama, upah: 0, kumulatif: 0, total: 0, item: [] };
    const harga = Number(i.harga) || 0;
    const a = persenItem(awal[k]), b = persenItem(akhir[k]);
    const upah = (harga * (b - a)) / 100;
    t.upah += upah;
    t.kumulatif += (harga * b) / 100;
    t.total += harga;
    t.item.push({ id: i.id, nama: i.nama, area: i.area, harga, sebelum: a, sesudah: b, naik: b - a, upah });
    tim.set(nama, t);
  });

  const jumlahTahap = [...poinTahap.values()].reduce((a, v) => a + v, 0);
  const tahap = [...poinTahap.entries()]
    .map(([label, poin]) => ({ label, poin, bagian: jumlahTahap ? (poin / jumlahTahap) * 100 : 0 }))
    .sort((a, b) => b.poin - a.poin);

  const sebelum = persenProyek(awal), sesudah = persenProyek(akhir);
  return {
    sebelum, sesudah, naik: sesudah - sebelum, tahap,
    tim: [...tim.values()]
      .map((t) => ({ ...t, item: t.item.sort((x, y) => Math.abs(y.upah) - Math.abs(x.upah) || x.nama.localeCompare(y.nama)) }))
      .sort((a, b) => (a.tim === "Belum ada tim") - (b.tim === "Belum ada tim") || a.tim.localeCompare(b.tim)),
  };
}
