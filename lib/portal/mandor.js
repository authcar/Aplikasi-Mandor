// Penghubung Portal Klien <-> Aplikasi Mandor untuk defect dari klien.
// Server-only (service role). Proyek portal tersambung ke proyek Mandor yang
// AKTIF dengan nama yang sama (tanpa beda huruf besar/kecil dan spasi), atau
// yang supervisornya sama dengan supervisor proyek portal.
// Proyek Mandor yang tidak aktif tidak dipakai: Defect List Mandor hanya
// menampilkan proyek aktif, jadi laporan klien di sana tidak akan terlihat tim.
import { db, hasil } from "./db";
import { gabungkanMediaPerbaikan } from "@/lib/perbaikanMedia";
import { kirimDriveSync } from "@/lib/driveSync";

const normal = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Proyek Mandor pasangan proyek portal: { id, nama, supervisor_id } atau null.
// 1) nama sama dengan proyek Mandor aktif; 2) kalau tidak ada, proyek Mandor
// aktif milik supervisor yang sama dengan proyek portal (kalau supervisornya
// punya beberapa proyek aktif, dipilih yang terbaru dibuat).
export async function cariProyekMandor(proyekPortal) {
  const { nama, supervisor_id } = typeof proyekPortal === "object" ? proyekPortal : { nama: proyekPortal };
  const rows = await hasil(db().from("proyek").select("*").eq("is_active", true));
  const sama = normal(nama) && rows.find((p) => normal(p.nama) === normal(nama));
  if (sama) return { id: sama.id, nama: sama.nama, supervisor_id: sama.supervisor_id };
  if (!supervisor_id) return null;
  const milik = rows
    .filter((p) => p.supervisor_id === supervisor_id)
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return milik[0] ? { id: milik[0].id, nama: milik[0].nama, supervisor_id: milik[0].supervisor_id } : null;
}

// Buat item Defect List Mandor dari laporan klien: foto -> bucket 'perbaikan'
// (<proyek_id>/..., konvensi PerbaikanForm), baris checklist_perbaikan (status
// OPEN, nomor lanjut) + checklist_perbaikan_media 'temuan', lalu picu sync ke
// Google Drive seperti temuan dari supervisor. Uraian diberi awalan "Klien"
// supaya tim tahu asalnya. created_by = supervisor proyek Mandor (kolomnya
// wajib diisi akun), kalau kosong akun MASTER pertama.
// Return { id, hapus } -- hapus() membatalkan semuanya kalau langkah
// sesudahnya (baris portal_defect) gagal.
export async function buatChecklistKlien(pm, { keterangan, pelapor, itemNama, foto }) {
  const uraian = `Klien${pelapor ? ` (${pelapor})` : ""}${itemNama ? ` · ${itemNama}` : ""}: ${keterangan}`;
  let pembuat = pm.supervisor_id;
  if (!pembuat) {
    const m = await hasil(db().from("profiles").select("id").eq("role", "MASTER").limit(1));
    pembuat = m[0]?.id;
    if (!pembuat) throw new Error("belum ada akun supervisor/master untuk mencatat defect.");
  }
  const akhir = await hasil(db().from("checklist_perbaikan").select("no").eq("proyek_id", pm.id).order("no", { ascending: false }).limit(1));
  const no = (akhir[0]?.no || 0) + 1;

  const paths = [];
  let id = null;
  const hapus = async () => {
    if (id) await db().from("checklist_perbaikan").delete().eq("id", id); // media ikut (cascade)
    if (paths.length) await db().storage.from("perbaikan").remove(paths);
  };
  try {
    for (let i = 0; i < foto.length; i++) {
      const f = foto[i];
      const ext = (String(f.name).split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${pm.id}/${Date.now()}-klien-${i}.${ext}`;
      const { error } = await db().storage.from("perbaikan").upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
      if (error) throw new Error(`foto gagal diunggah (${error.message}).`);
      paths.push(path);
    }
    const row = await hasil(
      db().from("checklist_perbaikan").insert({ proyek_id: pm.id, no, uraian, created_by: pembuat }).select("id, no, uraian, created_at").single()
    );
    id = row.id;
    const media = paths.length
      ? await hasil(
          db().from("checklist_perbaikan_media")
            .insert(paths.map((path, urutan) => ({ checklist_id: id, jenis: "temuan", tipe: "foto", path, urutan })))
            .select("id, tipe, path")
        )
      : [];
    // Sync ke Drive tidak ditunggu hasilnya untuk menentukan berhasil/gagal.
    await kirimDriveSync(db(), {
      proyekId: pm.id, proyek: pm.nama,
      items: [{ ...row, jenis: "temuan", media: media.map((m) => ({ mediaId: m.id, tipe: m.tipe, path: m.path })) }],
    });
    return { id, hapus };
  } catch (e) {
    await hapus();
    throw e;
  }
}

// Halaman Defect List di Aplikasi Mandor per role akun (profiles.role).
export const PATH_DEFECT_MANDOR = { MASTER: "/master/perbaikan", FINANCE: "/finance/perbaikan", SUPERVISOR: "/supervisor/perbaikan" };

// Status checklist_perbaikan -> status defect di portal (STATUS_DEFECT).
const STATUS = { OPEN: "BARU", IN_PROGRESS: "DIPROSES", PENDING_REVIEW: "DIPROSES", DONE: "SELESAI", CANCELLED: "DITUTUP" };

const KOLOM_CHECKLIST =
  "id, status, selesai_at, foto_url, video_url, foto_bukti_url, video_bukti_url, foto_drive_file_id, video_drive_file_id, foto_bukti_drive_file_id, video_bukti_drive_file_id";

// Lengkapi baris portal_defect yang tersambung (checklist_id) dengan data
// Defect List Mandor: status, foto laporan (temuan), dan foto bukti pengerjaan
// sebagai foto tanggapan (hanya setelah disetujui supervisor / DONE).
// Bentuk foto mengikuti lib/portal/defect.js: [{ path, url }].
export async function isiDariMandor(rows) {
  const ids = rows.map((r) => r.checklist_id).filter(Boolean);
  if (!ids.length) return rows;
  const [cl, media] = await Promise.all([
    hasil(db().from("checklist_perbaikan").select(KOLOM_CHECKLIST).in("id", ids)),
    hasil(db().from("checklist_perbaikan_media").select("id, checklist_id, jenis, tipe, path, urutan, drive_file_id").in("checklist_id", ids)),
  ]);
  const paths = [
    ...cl.flatMap((c) => [c.foto_url, c.video_url, c.foto_bukti_url, c.video_bukti_url]),
    ...media.map((m) => m.path),
  ].filter(Boolean);
  const urlMap = {};
  if (paths.length) {
    const { data } = await db().storage.from("perbaikan").createSignedUrls([...new Set(paths)], 6 * 3600);
    for (const d of data || []) if (d.signedUrl) urlMap[d.path] = d.signedUrl;
  }
  const gabung = gabungkanMediaPerbaikan(cl, media, urlMap);
  const byId = Object.fromEntries(cl.map((c, n) => [c.id, { c, m: gabung[n] }]));
  const foto = (list) => list.filter((x) => x.tipe === "foto").map((x) => ({ path: x.path || x.url, url: x.url }));
  return rows.map((r) => {
    const x = r.checklist_id && byId[r.checklist_id];
    if (!x) return r;
    const selesai = x.c.status === "DONE";
    return {
      ...r,
      mandor: true,
      status: STATUS[x.c.status] || "BARU",
      foto: foto(x.m.mediaTemuan),
      foto_tanggapan: selesai ? foto(x.m.mediaBukti) : [],
      diubah_at: selesai ? x.c.selesai_at : r.diubah_at,
    };
  });
}
