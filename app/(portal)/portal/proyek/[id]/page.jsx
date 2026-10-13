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
    ambilTermin(proyek.id),
    admin ? ambilKlien(proyek.id) : [],
    admin ? ambilSupervisor() : [],
  ]);

  return <AdminProyek proyek={proyek} items={items} termin={termin} klien={klien} supervisors={supervisors} staf={staf} />;
}
