// Kompresi foto di HP, sebelum diupload.
//
// Kamera HP sekarang menghasilkan JPEG 3–8 MB (sisi terpanjang 4000px+),
// padahal yang dibutuhkan aplikasi ini cuma bukti visual yang jelas dibaca di
// layar 6 inci dan di rekap. Mengirim file aslinya membakar kuota mandor,
// bikin upload gagal di sinyal proyek yang lemah, dan menumpuk di Supabase
// Storage & Google Drive tanpa guna. Turun ke 1600px + kualitas 0,7 biasanya
// memangkas ukurannya sekitar 10×, dan di layar HP hasilnya tidak terbedakan.
//
// ATURAN UTAMA: kegagalan kompresi TIDAK PERNAH membatalkan upload. Kalau
// format filenya tidak bisa dibaca browser (HEIC di Android lama, file rusak),
// atau hasilnya justru lebih besar, file ASLINYA yang dipakai. Foto lapangan
// yang lewat apa adanya masih jauh lebih baik daripada laporan yang gagal
// terkirim.

export const SISI_MAKS = 1600;
export const KUALITAS = 0.7;

// Di bawah ukuran ini kompresi jarang menghemat banyak, tapi ongkos
// decode + encode-nya tetap dibayar HP kentang — jadi dilewati saja.
const BATAS_LEWATI_BYTE = 300 * 1024;

// Nama file ikut diganti ke .jpg karena isinya memang sudah JPEG. Route
// upload (mis. app/api/keuangan) mengambil ekstensi dari nama file untuk
// menyusun path di Storage — tanpa ini, file JPEG bisa tersimpan bernama
// .heic/.png dan gagal ditampilkan browser saat dibuka lagi.
const namaJpg = (nama) => `${(nama || "foto").replace(/\.[^.]+$/, "")}.jpg`;

const bacaGambar = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak terbaca"));
    };
    // <img> memakai orientasi EXIF secara default di browser modern, jadi
    // foto potret tetap tegak setelah digambar ulang ke canvas. Ini alasan
    // dipakainya <img>, bukan createImageBitmap yang perlu opsi terpisah dan
    // dukungannya lebih timpang di Safari lama.
    img.src = url;
  });

// Gambar ulang sebuah sumber (Image/Video/Canvas) ke canvas berukuran maks
// `sisiMaks`, lalu keluarkan JPEG. Dipakai bersama oleh kompresGambar() dan
// KameraModal (yang sumbernya elemen <video>, bukan file).
export async function keJpegKecil(sumber, lebar, tinggi, { sisiMaks = SISI_MAKS, kualitas = KUALITAS } = {}) {
  const skala = Math.min(1, sisiMaks / Math.max(lebar, tinggi));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(lebar * skala));
  canvas.height = Math.max(1, Math.round(tinggi * skala));

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // Latar putih dulu: PNG/HEIC dengan area transparan yang di-encode jadi
  // JPEG (yang tidak punya alpha) akan berubah jadi bercak hitam tanpa ini.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sumber, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", kualitas));
  // Lepaskan memori canvas segera — di HP RAM 2 GB, beberapa foto beruntun
  // tanpa ini cukup untuk bikin tab-nya dimatikan sistem.
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

// Kompres satu file. File non-gambar (video!) dikembalikan apa adanya, jadi
// fungsi ini aman dipanggil di input yang menerima campuran foto & video.
export async function kompresGambar(file, opsi) {
  if (!file || !file.type?.startsWith("image/")) return file;
  if (file.size <= BATAS_LEWATI_BYTE) return file;

  try {
    const img = await bacaGambar(file);
    const blob = await keJpegKecil(img, img.naturalWidth, img.naturalHeight, opsi);
    // Hasil yang tidak lebih kecil = tidak ada gunanya ditukar (mis. foto
    // yang memang sudah dikompres habis, atau gambar kaya detail).
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], namaJpg(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

// Versi banyak file untuk input `multiple` (defect list). Dijalankan berurutan,
// bukan Promise.all: mendekode 5 foto 8 MB sekaligus bisa menghabiskan memori
// HP kelas bawah, dan bedanya cuma sepersekian detik.
export async function kompresBanyakGambar(files, opsi) {
  const hasil = [];
  for (const file of files) hasil.push(await kompresGambar(file, opsi));
  return hasil;
}
