import { notFound } from "next/navigation";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilItem, ambilProyek, ambilTermin, ambilAddon, ambilKlien, ambilSupervisor, timSaya } from "@/lib/portal/data";
import { ambilDefect } from "@/lib/portal/defect";
import { cariProyekMandor, PATH_DEFECT_MANDOR } from "@/lib/portal/mandor";
import { urlFotoItem } from "@/lib/portal/fotoItem";
import { ambilFotoProgres } from "@/lib/portal/progresFoto";
import { ambilRiwayat } from "@/lib/portal/riwayat";
import { DEFECT_AKTIF } from "@/lib/portal/format";
import AdminProyek from "./AdminProyek";

// portal_item.foto (path storage) -> daftar signed URL untuk ditampilkan.
async function urlkanFoto(items) {
  const url = await urlFotoItem(items.flatMap((i) => i.foto || [])).catch(() => ({}));
  return items.map((i) => ({ ...i, foto: (i.foto || []).map((f) => url[f]).filter(Boolean) }));
}

export default async function PortalProyekPage({ params }) {
  // Staf dan proyek diambil bersamaan (saling tidak bergantung).
  const [{ staf }, p] = await Promise.all([ambilStaf(), ambilProyek(params.id)]);
  const tukang = staf?.role === "TUKANG";
  if (!tukang && !bolehProyek(staf, p)) notFound();
  if (tukang && !p) notFound();
  const { created_at, created_by, ...proyek } = p;

  // Tukang hanya melihat item timnya, dan hanya total jasa per item (harga
  // satuan tidak dikirim ke browser). Tidak ada item timnya = bukan proyeknya.
  if (tukang) {
    const { nilai_proyek, nilai_perancangan, ...p2 } = proyek;
    const [semua, fotoSemua, riwayatSemua] = await Promise.all([ambilItem([proyek]), ambilFotoProgres(proyek.id), ambilRiwayat(proyek.id)]);
    const items = await urlkanFoto(semua.filter((i) => timSaya(staf, i)).map(({ harga_satuan, ...i }) => i));
    if (!items.length) notFound();
    const milik = new Set(items.map((i) => i.id));
    return (
      <AdminProyek proyek={p2} items={items} termin={[]} klien={[]} supervisors={[]} staf={staf}
        fotoProgres={fotoSemua.filter((x) => milik.has(x.item_id))} riwayat={riwayatSemua.filter((x) => milik.has(x.item_id))} />
    );
  }

  const admin = staf.role === "ADMIN";
  const [items, termin, addon, klien, supervisors, defect, pm, fotoProgres, riwayat] = await Promise.all([
    ambilItem([proyek]).then(urlkanFoto),
    admin ? ambilTermin(proyek.id) : [],
    admin ? ambilAddon(proyek.id) : [],
    admin ? ambilKlien(proyek.id) : [],
    admin ? ambilSupervisor() : [],
    // Defect (dan sambungan ke Defect List Mandor) hanya dibaca kalau fiturnya aktif.
    DEFECT_AKTIF && !admin ? ambilDefect(proyek.id) : [], // defect hanya untuk supervisor
    DEFECT_AKTIF && !admin ? cariProyekMandor(proyek.nama) : null,
    ambilFotoProgres(proyek.id),
    ambilRiwayat(proyek.id),
  ]);
  // Proyek yang tersambung ke Aplikasi Mandor: defect klien dikelola di Defect List Mandor.
  const mandor = pm ? { nama: pm.nama, path: PATH_DEFECT_MANDOR[staf.peran] || null } : null;

  // Supervisor mencatat progres dan menanggapi defect: nilai jasa tukang, nilai
  // proyek, dan termin tidak ikut dikirim ke browser sama sekali (bukan sekadar disembunyikan).
  if (!admin) {
    const { nilai_proyek, nilai_perancangan, ...p2 } = proyek;
    // `berat` = harga item (rupiah) kalau semua item berharga, jadi diubah ke
    // porsi (total 100) supaya hitungan progres tetap sama tanpa membuka nilainya.
    const totalBerat = items.reduce((a, i) => a + (Number(i.berat) || 0), 0) || 1;
    const items2 = items.map(({ harga, harga_satuan, berat, ...i }) => ({ ...i, berat: ((Number(berat) || 0) / totalBerat) * 100 }));
    return <AdminProyek proyek={p2} items={items2} termin={[]} klien={[]} supervisors={[]} defect={defect} mandor={mandor} staf={staf} fotoProgres={fotoProgres} riwayat={riwayat} />;
  }
  return (
    <AdminProyek proyek={proyek} items={items} termin={termin} addon={addon} klien={klien} supervisors={supervisors} defect={defect} mandor={mandor} staf={staf}
      fotoProgres={fotoProgres} riwayat={riwayat} />
  );
}
