import Link from "next/link";
import { ambilStaf } from "@/lib/portal/server";
import { ambilItem, ambilProyekStaf, ambilSupervisor } from "@/lib/portal/data";
import { persenProyek } from "@/lib/portal/progresBoq";
import { tglTh, pct, statusProyek } from "@/lib/portal/format";
import ProyekBaru from "./ProyekBaru";

export default async function PortalBeranda() {
  const { staf } = await ambilStaf();
  const admin = staf.role === "ADMIN";
  const [proyek, supervisors] = await Promise.all([ambilProyekStaf(staf), admin ? ambilSupervisor() : []]);
  const items = await ambilItem(proyek.map((p) => p.id));

  return (
    <main className="wrap">
      <div className="row" style={{ alignItems: "center" }}>
        <div>
          <div className="eb">{admin ? "Admin" : "Supervisor"}</div>
          <h1>Proyek</h1>
        </div>
        {admin && <Link href="/portal/bobot" className="act">Bobot tahap</Link>}
      </div>

      {admin && <ProyekBaru supervisors={supervisors} />}

      {!proyek.length && (
        <div className="card small">
          {admin ? "Belum ada proyek. Ketuk “+ Proyek baru” di atas untuk membuat yang pertama." : "Belum ada proyek yang ditugaskan ke Anda."}
        </div>
      )}

      {proyek.map((p) => {
        const its = items.filter((i) => i.proyek_id === p.id);
        const v = persenProyek(its);
        const [st, cls] = statusProyek({ ...p, items: its });
        return (
          <Link key={p.id} href={`/portal/proyek/${p.id}`} className="proj">
            <div className="row" style={{ alignItems: "center" }}>
              <span className="small" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[p.kode, p.klien_nama].filter(Boolean).join(" · ") || "—"}</span>
              <span className={`badge ${p.aktif ? cls : "b-n"}`}>{p.aktif ? st : "Arsip"}</span>
            </div>
            <h3>{p.nama}</h3>
            <div className="small">
              {its.length} item{p.deadline ? ` · Deadline ${tglTh(p.deadline)}` : ""}
            </div>
            <div className="row" style={{ alignItems: "center" }}>
              <div className="bar" style={{ flex: 1 }}><i style={{ width: `${v}%` }} /></div>
              <b className="num">{pct(v)}</b>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
