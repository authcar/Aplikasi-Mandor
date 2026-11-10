// Foto dokumentasi laporan harian: satu kegiatan bisa punya banyak foto.
// foto_urls = daftar lengkap (urutan tampil di PDF); foto_url = foto pertama,
// dipertahankan untuk tampilan lama. Baris lama (sebelum foto_urls ada isinya)
// hanya punya foto_url, jadi dibaca lewat daftarFoto().

export const MAKS_FOTO_KEGIATAN = 10;

export const daftarFoto = (row) =>
  row?.foto_urls?.length ? row.foto_urls : row?.foto_url ? [row.foto_url] : [];

// Kolom yang harus ditulis bersamaan agar tetap sinkron.
export const kolomFoto = (paths) => ({ foto_url: paths[0] || null, foto_urls: paths });

// Tanda tangani semua foto dari baris-baris laporan_harian (satu panggilan ke
// storage) dan tempelkan: fotoSignedUrls = semua foto berurutan, fotoSignedUrl
// = yang pertama (dipakai thumbnail). Baris perlu kolom foto_url & foto_urls.
// `supabase` = client yang boleh membaca bucket 'progres'.
export async function tambahUrlFoto(supabase, rows) {
  const paths = [...new Set((rows || []).flatMap(daftarFoto))];
  const { data: signed } = paths.length
    ? await supabase.storage.from("progres").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  return (rows || []).map((r) => {
    const ada = daftarFoto(r).filter((p) => urlMap[p]);
    // fotoPaths sejajar dengan fotoSignedUrls (dipakai untuk menghapus foto satuan).
    return { ...r, fotoPaths: ada, fotoSignedUrls: ada.map((p) => urlMap[p]), fotoSignedUrl: urlMap[ada[0]] || null };
  });
}

// File yang benar-benar terisi dari form (getAll bisa mengembalikan string kosong).
export const fileFoto = (form) =>
  form.getAll("foto").filter((f) => f && typeof f === "object" && f.size > 0);
