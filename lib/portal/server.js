import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { db, hasil } from "./db";
import { ambilBobotTahap, bacaProgres } from "./data";
import { ambilDefect } from "./defect";
import { urlFotoItem } from "./fotoItem";
import { beriBerat } from "./progresBoq";

// Peran di portal diturunkan dari role akun Aplikasi Mandor. FINANCE setara
// MASTER (termasuk mengisi nilai jasa tukang). MANDOR = TUKANG: hanya melihat
// item yang "Tim tukang"-nya sama dengan nama akunnya, tanpa bisa mengubah apa pun.
const PERAN = { MASTER: "ADMIN", FINANCE: "ADMIN", SUPERVISOR: "SUPERVISOR", MANDOR: "TUKANG" };

// Staf portal untuk user yang login (null kalau role-nya tidak punya akses).
// Belum login -> /login.
export async function ambilStaf() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  const role = PERAN[profile?.role];
  // peran = role asli akun Mandor (MASTER/FINANCE/SUPERVISOR/MANDOR), mis. untuk tautan ke halaman Mandor.
  return { staf: role ? { id: profile.id, nama: profile.name, role, peran: profile.role } : null };
}

// Boleh membuka/mencatat progres di proyek ini. Supervisor boleh di semua
// proyek (kolom Supervisor proyek hanya keterangan). Tukang tidak pernah (lihat timSaya).
export const bolehProyek = (staf, proyek) =>
  !!staf && !!proyek && (staf.role === "ADMIN" || staf.role === "SUPERVISOR");

// Satu proyek untuk klien yang membuka link rahasia /k/[token] (hanya kolom aman).
// null kalau token tidak ada / sudah dicabut.
export async function ambilProyekKlien(token) {
  if (!/^[\w-]{20,}$/.test(token || "")) return null;
  const link = await hasil(db().from("portal_link").select("proyek_id, nama").eq("token", token).maybeSingle());
  if (!link) return null;
  const p = await hasil(
    db().from("portal_proyek")
      // "*" (bukan daftar kolom) supaya tetap jalan sebelum kolom timbang_harga ada.
      .select("*, supervisor:supervisor_id(name)")
      .eq("id", link.proyek_id)
      .maybeSingle()
  );
  if (!p) return null;
  const [bobot, items, termin, defect] = await Promise.all([
    ambilBobotTahap(),
    hasil(
      db().from("portal_item")
        .select("*, portal_progres(*, pencatat:dicatat_oleh(name))")
        .eq("proyek_id", p.id)
        .order("urutan")
        .order("created_at")
    ),
    hasil(db().from("portal_termin").select("*").eq("proyek_id", p.id).order("urutan")),
    ambilDefect(p.id),
  ]);

  // Foto contoh item -> signed URL (kolom foto belum ada / bucket belum dibuat -> tanpa foto).
  const urlFoto = await urlFotoItem(items.flatMap((i) => i.foto || [])).catch(() => ({}));

  let terakhir = null;
  for (const i of items)
    for (const g of i.portal_progres) if (!terakhir || g.dicatat_at > terakhir.dicatat_at) terakhir = g;

  return {
    id: p.id, kode: p.kode, nama: p.nama, lokasi: p.lokasi, mulai: p.mulai, deadline: p.deadline, aktif: p.aktif,
    nilai_proyek: p.nilai_proyek ?? null,
    klien: link.nama || null,
    supervisor: p.supervisor?.name || null,
    items: beriBerat(
      items.map(({ portal_progres, ...i }) => ({
        ...i,
        foto: (i.foto || []).map((f) => urlFoto[f]).filter(Boolean),
        bobot_tahap: i.bobot_tahap || bobot[i.jenis] || null,
        ...bacaProgres(portal_progres),
      })),
      p.timbang_harga
    // Nilai jasa tukang per item urusan internal, tidak dikirim ke klien.
    ).map(({ harga, harga_satuan, tim, ...i }) => i),
    termin: termin.map((t) => ({
      jenis: t.jenis || "produksi", label: t.label, persen: t.persen, jatuh_tempo: t.jatuh_tempo, lunas_tgl: t.lunas_tgl, dibayar: t.dibayar ?? null,
    })),
    update_terakhir: terakhir ? { at: terakhir.dicatat_at, oleh: terakhir.pencatat?.name || null } : null,
    // Defect yang dikirim lewat link ini (nama staf yang mengubah tidak dikirim).
    defect: defect.map((d) => ({
      id: d.id, item_id: d.item_id, keterangan: d.keterangan, status: d.status, tanggapan: d.tanggapan,
      created_at: d.created_at, diubah_at: d.diubah_at, foto: d.foto.map((f) => f.url).filter(Boolean),
      foto_tanggapan: d.foto_tanggapan.map((f) => f.url).filter(Boolean),
    })),
  };
}
