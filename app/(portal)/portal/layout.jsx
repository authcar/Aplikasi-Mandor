import { redirect } from "next/navigation";
import { ambilStaf } from "@/lib/portal/server";
import { ambilProyekStaf } from "@/lib/portal/data";
import { hitungDefectBaru } from "@/lib/portal/defect";
import { DEFECT_AKTIF, labelDeadline, lewatDeadline } from "@/lib/portal/format";
import Header from "../Header";
import Sidebar from "../Sidebar";

export const dynamic = "force-dynamic";

const PERAN = { ADMIN: "Admin", TUKANG: "Tukang" };

// Pemberitahuan di lonceng: deadline yang tinggal 7 hari atau sudah lewat, dan
// defect baru dari klien (kalau fiturnya aktif). Hanya proyek yang masih aktif.
async function ambilNotif(staf, proyek) {
  const defect = staf.role === "TUKANG" || !DEFECT_AKTIF ? {} : await hitungDefectBaru();
  const notif = [];
  for (const p of proyek.filter((x) => x.aktif)) {
    const href = `/portal/proyek/${p.id}`;
    if (p.deadline) {
      const [teks, kelas] = labelDeadline(p.deadline);
      if (kelas === "b-bad" || kelas === "b-warn")
        notif.push({ id: `d-${p.id}`, jenis: "deadline", judul: p.nama, sub: lewatDeadline(p) ? "Proyek terkunci karena lewat deadline" : "Deadline mendekat", label: teks, kelas, href });
    }
    if (defect[p.id] > 0)
      notif.push({ id: `f-${p.id}`, jenis: "defect", judul: p.nama, sub: "Ada laporan defect dari klien", label: `${defect[p.id]} baru`, kelas: "b-bad", href });
  }
  return notif;
}

// Area staf portal (MASTER/FINANCE = admin, SUPERVISOR, MANDOR = tukang). Role lain dikembalikan ke
// berandanya sendiri (middleware.js sudah menyaring; ini lapis kedua).
export default async function StafLayout({ children }) {
  const { staf } = await ambilStaf();
  if (!staf) redirect("/");
  const proyek = await ambilProyekStaf(staf).catch(() => []);
  const notif = await ambilNotif(staf, proyek).catch(() => []);
  return (
    <>
      <Header kembali label={`Project Tracker · ${staf.nama}`} notif={notif} />
      <div className="shell">
        <Sidebar admin={staf.role === "ADMIN"} nama={staf.nama} peran={PERAN[staf.role] || "Supervisor"} jumlah={proyek.filter((p) => p.aktif).length} />
        <div className="isi">{children}</div>
      </div>
    </>
  );
}
