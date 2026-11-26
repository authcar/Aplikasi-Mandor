// Mengenali dua catatan untuk proyek yang sama, supaya sinkron otomatis tidak membuat
// proyek tracker dobel. Nomor proyek (6 angka) sering hanya ditulis di nama
// ("AF House - 001386"), jadi dibaca dari sana juga. Fungsi murni.
export const normalNama = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Semua kode yang dimiliki satu catatan: isi kolom kode + nomor 6 angka di namanya.
export const kodeKode = (kode, nama) => {
  const isi = String(kode || "").trim().replace(/\s+/g, "-").toUpperCase();
  const diNama = String(nama || "").match(/(?<!\d)\d{6}(?!\d)/)?.[0];
  return [...new Set([isi, diNama].filter(Boolean))];
};

const samaKode = (a, b) => a.some((k) => b.includes(k));

// Baris `daftar` ({ nama, kode }) yang tampak sama dengan kartu Taraco ({ name, code }).
// Yang namanya persis sama didahulukan.
export function yangMirip(kartu, daftar) {
  const nama = normalNama(kartu.name);
  const kode = kodeKode(kartu.code, kartu.name);
  const persis = daftar.filter((r) => nama && normalNama(r.nama) === nama);
  const lewatKode = daftar.filter((r) => !persis.includes(r) && samaKode(kode, kodeKode(r.kode, r.nama)));
  return [...persis, ...lewatKode];
}
