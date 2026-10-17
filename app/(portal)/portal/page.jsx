import Link from "next/link";
import { ambilStaf } from "@/lib/portal/server";
import { ambilItem, ambilProyekStaf, ambilSupervisor, timSaya } from "@/lib/portal/data";
import { hitungDefectBaru } from "@/lib/portal/defect";
import { persenProyek } from "@/lib/portal/progresBoq";
import { tglTh, pct, statusProyek, labelDeadline, lewatDeadline } from "@/lib/portal/format";
import ProyekBaru from "./ProyekBaru";

export default async function PortalBeranda() {
  const { staf } = await ambilStaf();
  const admin = staf.role === "ADMIN";
  const tukang = staf.role === "TUKANG";
  const [proyek, supervisors, defectBaru] = await Promise.all([
    ambilProyekStaf(staf),
    admin ? ambilSupervisor() : [],
    tukang ? {} : hitungDefectBaru(),
  ]);
  // Tukang: jumlah item dan progres dihitung dari item timnya saja.
  const items = (await ambilItem(proyek)).filter((i) => !tukang || timSaya(staf, i));

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

      {!proyek.length && (
        <div className="card small">
          {admin ? "Belum ada proyek. Ketuk “+ Proyek baru” di atas untuk membuat yang pertama." : tukang ? `Belum ada item dengan tim tukang “${staf.nama}”.` : "Belum ada proyek."}
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
              <span className="row" style={{ gap: 6, flex: "none" }}>
                {defectBaru[p.id] > 0 && <span className="badge b-bad">{defectBaru[p.id]} defect baru</span>}
                <span className={`badge ${p.aktif ? cls : "b-n"}`}>{p.aktif ? st : "Arsip"}</span>
              </span>
            </div>
            <h3>{p.nama}</h3>
            <div className="small" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {its.length} item{p.deadline ? ` · Deadline ${tglTh(p.deadline)}` : ""}
              {p.deadline && p.aktif && (() => {
                const [teks, kelas] = labelDeadline(p.deadline);
                return <span className={`badge ${kelas}`}>{lewatDeadline(p) ? "Terkunci" : teks}</span>;
              })()}
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
