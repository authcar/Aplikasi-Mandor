import { notFound } from "next/navigation";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilItem, ambilProyek, ambilTermin, ambilKlien, ambilSupervisor, timSaya } from "@/lib/portal/data";
import AdminProyek from "./AdminProyek";

export default async function PortalProyekPage({ params }) {
  const { staf } = await ambilStaf();
  const p = await ambilProyek(params.id);
  const tukang = staf?.role === "TUKANG";
  if (!tukang && !bolehProyek(staf, p)) notFound();
  if (tukang && !p) notFound();
  const { created_at, created_by, ...proyek } = p;

  // Tukang hanya melihat item timnya, dan hanya total jasa per item (harga
  // satuan tidak dikirim ke browser). Tidak ada item timnya = bukan proyeknya.
  if (tukang) {
    const { nilai_proyek, nilai_perancangan, ...p2 } = proyek;
    const items = (await ambilItem([proyek])).filter((i) => timSaya(staf, i)).map(({ harga_satuan, ...i }) => i);
    if (!items.length) notFound();
    return <AdminProyek proyek={p2} items={items} termin={[]} klien={[]} supervisors={[]} staf={staf} />;
  }

  const admin = staf.role === "ADMIN";
  const [items, termin, klien, supervisors] = await Promise.all([
    ambilItem([proyek]),
    admin ? ambilTermin(proyek.id) : [],
    admin ? ambilKlien(proyek.id) : [],
    admin ? ambilSupervisor() : [],
  ]);

  // Supervisor hanya mencatat progres: nilai jasa tukang, nilai proyek, dan
  // termin tidak ikut dikirim ke browser sama sekali (bukan sekadar disembunyikan).
  if (!admin) {
    const { nilai_proyek, nilai_perancangan, ...p2 } = proyek;
    const items2 = items.map(({ harga, harga_satuan, ...i }) => i);
    return <AdminProyek proyek={p2} items={items2} termin={[]} klien={[]} supervisors={[]} staf={staf} />;
  }
  return <AdminProyek proyek={proyek} items={items} termin={termin} klien={klien} supervisors={supervisors} staf={staf} />;
}
