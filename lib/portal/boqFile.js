// File BoQ (Excel) asli per proyek: portal_proyek.boq_file = path di bucket privat
// 'portal-boq' (supabase/add_portal_boq_file.sql). Server-only.
import { db } from "./db";

export const BUCKET_BOQ = "portal-boq";

export async function hapusFileBoq(paths) {
  const ada = (paths || []).filter(Boolean);
  if (!ada.length) return;
  try {
    await db().storage.from(BUCKET_BOQ).remove(ada);
  } catch {}
}
