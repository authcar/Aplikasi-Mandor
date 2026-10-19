// Foto contoh item BOQ (portal_item.foto = path di bucket privat 'portal-item',
// supabase/add_portal_item_foto.sql). Server-only: ditampilkan lewat signed URL.
import { db } from "./db";

export const BUCKET_ITEM = "portal-item";
const UMUR_URL = 6 * 3600;

// { [path]: signedUrl } untuk semua path yang diberikan.
export async function urlFotoItem(paths) {
  const url = {};
  if (!paths.length) return url;
  const { data } = await db().storage.from(BUCKET_ITEM).createSignedUrls(paths, UMUR_URL);
  for (const d of data || []) if (d.signedUrl) url[d.path] = d.signedUrl;
  return url;
}

// Hapus berkas dari storage; gagal tidak menghalangi aksi pemanggil.
export async function hapusFotoItem(paths) {
  const ada = (paths || []).filter(Boolean);
  if (!ada.length) return;
  try {
    await db().storage.from(BUCKET_ITEM).remove(ada);
  } catch {}
}
