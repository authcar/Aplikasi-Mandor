import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { db, hasil } from "./db";
import { ambilBobotTahap } from "./data";
import { beriBerat } from "./progresBoq";

// Peran di portal diturunkan dari role akun Aplikasi Mandor.
const PERAN = { MASTER: "ADMIN", SUPERVISOR: "SUPERVISOR" };

// Staf portal untuk user yang login (null kalau role-nya tidak punya akses).
// Belum login -> /login.
export async function ambilStaf() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  const role = PERAN[profile?.role];
  return { staf: role ? { id: profile.id, nama: profile.name, role } : null };
}

export const bolehProyek = (staf, proyek) =>
  !!staf && !!proyek && (staf.role === "ADMIN" || proyek.supervisor_id === staf.id);

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
  const [bobot, items, termin] = await Promise.all([
    ambilBobotTahap(),
    hasil(
      db().from("portal_item")
        .select("*, portal_progres(tahap, selesai_tgl, dicatat_at, pencatat:dicatat_oleh(name))")
        .eq("proyek_id", p.id)
        .order("urutan")
        .order("created_at")
    ),
    hasil(db().from("portal_termin").select("*").eq("proyek_id", p.id).order("urutan")),
  ]);

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
        bobot_tahap: i.bobot_tahap || bobot[i.jenis] || null,
        progres: Object.fromEntries(portal_progres.map((g) => [g.tahap, g.selesai_tgl])),
      })),
      p.timbang_harga
    // Nilai jasa tukang per item urusan internal, tidak dikirim ke klien.
    ).map(({ harga, harga_satuan, tim, ...i }) => i),
    termin: termin.map((t) => ({
      jenis: t.jenis || "produksi", label: t.label, persen: t.persen, jatuh_tempo: t.jatuh_tempo, lunas_tgl: t.lunas_tgl, dibayar: t.dibayar ?? null,
    })),
    update_terakhir: terakhir ? { at: terakhir.dicatat_at, oleh: terakhir.pencatat?.name || null } : null,
  };
}
