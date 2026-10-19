import Link from "next/link";
import DaftarProyek from "./DaftarProyek";
import { ambilStaf } from "@/lib/portal/server";
import { ambilItem, ambilProyekStaf, ambilSupervisor, timSaya } from "@/lib/portal/data";
import { hitungDefectBaru } from "@/lib/portal/defect";
import { persenProyek } from "@/lib/portal/progresBoq";
import { tglTh, pct, statusProyek, labelDeadline, lewatDeadline, DEFECT_AKTIF } from "@/lib/portal/format";
import ProyekBaru from "./ProyekBaru";

export default async function PortalBeranda() {
  const { staf } = await ambilStaf();
  const admin = staf.role === "ADMIN";
  const tukang = staf.role === "TUKANG";
  const [proyek, supervisors, defectBaru] = await Promise.all([
    ambilProyekStaf(staf),
    admin ? ambilSupervisor() : [],
    tukang || !DEFECT_AKTIF ? {} : hitungDefectBaru(),
  ]);
  // Tukang: jumlah item dan progres dihitung dari item timnya saja.
  const items = (await ambilItem(proyek)).filter((i) => !tukang || timSaya(staf, i));

  const kartu = proyek.map((p) => {
    const its = items.filter((i) => i.proyek_id === p.id);
    const v = persenProyek(its);
    const [status, kelas] = statusProyek({ ...p, items: its });
    return {
      id: p.id, kode: p.kode, klien: p.klien_nama, nama: p.nama, lokasi: p.lokasi, aktif: p.aktif,
      n: its.length, deadline: p.deadline ? tglTh(p.deadline) : null,
      sisa: p.deadline && p.aktif ? [lewatDeadline(p) ? "Terkunci" : labelDeadline(p.deadline)[0], labelDeadline(p.deadline)[1]] : null,
      status, kelas, persen: v, persenTeks: pct(v), defect: defectBaru[p.id] || 0,
    };
  });

  return (
    <main className="wrap">
      <div className="row" style={{ alignItems: "center" }}>
        <div>
          <div className="eb">{admin ? "Admin" : tukang ? "Tukang" : "Supervisor"}</div>
          <h1>Proyek</h1>
        </div>
        {admin && <Link href="/portal/bobot" className="act">Bobot tahap</Link>}
      </div>

      {admin && <ProyekBaru supervisors={supervisors} />}

      <DaftarProyek kartu={kartu} kosong={admin ? "Belum ada proyek. Ketuk “+ Proyek baru” di atas untuk membuat yang pertama." : tukang ? `Belum ada item dengan tim tukang “${staf.nama}”.` : "Belum ada proyek."} />
    </main>
  );
}
