import { buatPdfAbsensiBulanan } from "./absensiPegawaiPdf.js";
import { BUCKET_ABSENSI, pathArsip, rentangBulan, tanggalWIB } from "./absensiPegawaiAturan.js";

// Arsip PDF absensi per bulan kalender. Semua fungsi menerima client service
// role (`admin`): bucketnya privat tanpa policy, dan route pemanggil sudah
// memeriksa perannya.

const KOLOM = [
  "profile_id", "tanggal", "masuk_at", "keluar_at",
  "lat_masuk", "lng_masuk", "lokasi_masuk", "alamat_masuk",
  "lat_keluar", "lng_keluar", "lokasi_keluar", "alamat_keluar",
  "terlambat", "pulang_cepat", "foto_masuk_path", "foto_keluar_path",
].join(", ");

// Jalankan fn untuk tiap item dengan paling banyak `n` yang berjalan bersamaan.
async function paralel(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

async function unduh(admin, path) {
  if (!path) return null;
  const { data, error } = await admin.storage.from(BUCKET_ABSENSI).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

// PDF bulan `bulan` ("YYYY-MM") dari data + foto saat ini. null kalau tidak ada
// satu pun baris absen bulan itu.
export async function buatPdfBulan(admin, bulan, { logo = null, sementara = false } = {}) {
  const { awal, akhir } = rentangBulan(bulan);
  const { data: baris, error } = await admin
    .from("absensi_pegawai")
    .select(KOLOM)
    .gte("tanggal", awal)
    .lt("tanggal", akhir)
    .order("tanggal")
    .order("masuk_at");
  if (error) throw new Error(error.message);
  if (!baris?.length) return null;

  const ids = [...new Set(baris.map((r) => r.profile_id))];
  const { data: pegawai, error: errPegawai } = await admin.from("profiles").select("id, name").in("id", ids);
  if (errPegawai) throw new Error(errPegawai.message);

  let jumlahFoto = 0;
  await paralel(baris, 8, async (r) => {
    [r.fotoMasuk, r.fotoKeluar] = await Promise.all([unduh(admin, r.foto_masuk_path), unduh(admin, r.foto_keluar_path)]);
    jumlahFoto += (r.fotoMasuk ? 1 : 0) + (r.fotoKeluar ? 1 : 0);
  });

  const pdf = buatPdfAbsensiBulanan({
    bulan,
    pegawai: pegawai || [],
    baris,
    logo,
    sementara,
    hariIni: tanggalWIB(),
  });
  // `diharapkan` = foto yang tercatat di tabel; kalau jumlahFoto lebih sedikit,
  // ada foto yang gagal diunduh dan PDF-nya belum lengkap.
  const diharapkan = baris.reduce((n, r) => n + (r.foto_masuk_path ? 1 : 0) + (r.foto_keluar_path ? 1 : 0), 0);
  return { pdf, jumlahFoto, diharapkan };
}

export async function ambilArsip(admin, bulan) {
  const { data } = await admin.from("absensi_pegawai_arsip").select("*").eq("bulan", bulan).maybeSingle();
  return data || null;
}

// Buat PDF final bulan itu, simpan ke bucket + catat di tabel arsip.
// Mengembalikan { pdf, jumlahFoto } atau null kalau bulannya kosong.
export async function simpanArsip(admin, bulan, opsi = {}) {
  const hasil = await buatPdfBulan(admin, bulan, { ...opsi, sementara: false });
  if (!hasil) return null;

  const path = pathArsip(bulan);
  const { error } = await admin.storage
    .from(BUCKET_ABSENSI)
    .upload(path, Buffer.from(hasil.pdf), { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Unggah arsip gagal: ${error.message}`);

  const { error: errCatat } = await admin
    .from("absensi_pegawai_arsip")
    .upsert({ bulan, pdf_path: path, jumlah_foto: hasil.jumlahFoto, dibuat_at: new Date().toISOString() });
  if (errCatat) throw new Error(`Catat arsip gagal: ${errCatat.message}`);
  return hasil;
}

// Hapus foto satuan sebulan (setelah arsip PDF-nya ada) dan kosongkan path-nya.
// Baris absen (jam, koordinat, alamat) tidak disentuh.
export async function hapusFotoBulan(admin, bulan) {
  const { awal, akhir } = rentangBulan(bulan);
  const { data: baris, error } = await admin
    .from("absensi_pegawai")
    .select("profile_id, tanggal, foto_masuk_path, foto_keluar_path")
    .gte("tanggal", awal)
    .lt("tanggal", akhir);
  if (error) throw new Error(error.message);

  const paths = (baris || []).flatMap((r) => [r.foto_masuk_path, r.foto_keluar_path]).filter(Boolean);
  for (let n = 0; n < paths.length; n += 100) {
    const { error: errHapus } = await admin.storage.from(BUCKET_ABSENSI).remove(paths.slice(n, n + 100));
    if (errHapus) throw new Error(`Hapus foto gagal: ${errHapus.message}`);
  }

  const { error: errNull } = await admin
    .from("absensi_pegawai")
    .update({ foto_masuk_path: null, foto_keluar_path: null })
    .gte("tanggal", awal)
    .lt("tanggal", akhir);
  if (errNull) throw new Error(errNull.message);

  await admin
    .from("absensi_pegawai_arsip")
    .update({ foto_dihapus_at: new Date().toISOString() })
    .eq("bulan", bulan);
  return paths.length;
}
