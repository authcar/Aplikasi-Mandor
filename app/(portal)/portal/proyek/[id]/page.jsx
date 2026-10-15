import { notFound } from "next/navigation";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilItem, ambilProyek, ambilTermin, ambilKlien, ambilSupervisor } from "@/lib/portal/data";
import AdminProyek from "./AdminProyek";

export default async function PortalProyekPage({ params }) {
  const { staf } = await ambilStaf();
  const p = await ambilProyek(params.id);
  if (!bolehProyek(staf, p)) notFound();
  const { created_at, created_by, ...proyek } = p;

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
    const items2 = items.map(({ harga, ...i }) => i);
    return <AdminProyek proyek={p2} items={items2} termin={[]} klien={[]} supervisors={[]} staf={staf} />;
  }
  return <AdminProyek proyek={proyek} items={items} termin={termin} klien={klien} supervisors={supervisors} staf={staf} />;
}
