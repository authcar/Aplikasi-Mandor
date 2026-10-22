import Link from "next/link";
import DaftarProyek from "./DaftarProyek";
import { ambilStaf } from "@/lib/portal/server";
import { ambilItem, ambilProyekStaf, ambilSupervisor, timSaya } from "@/lib/portal/data";
import { hitungDefectBaru } from "@/lib/portal/defect";
import { persenProyek } from "@/lib/portal/progresBoq";
import { hariIni, tambahHari, tglTh, pct, statusProyek, labelDeadline, lewatDeadline, DEFECT_AKTIF } from "@/lib/portal/format";
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

  const hari = hariIni();
  const sebelumSenin = tambahHari(hari, -((new Date(`${hari}T00:00:00Z`).getUTCDay() + 6) % 7) - 1); // hari Minggu lalu
  const kartu = proyek.map((p) => {
    const its = items.filter((i) => i.proyek_id === p.id);
    const v = persenProyek(its);
    const [status, kelas] = statusProyek({ ...p, items: its });
    // Ada kenaikan progres sejak Senin minggu kalender ini?
    const adaProgres = v - persenProyek(its, sebelumSenin) > 0.005;
    return {
      id: p.id, kode: p.kode, klien: p.klien_nama, nama: p.nama, lokasi: p.lokasi, aktif: p.aktif,
      n: its.length, deadline: p.deadline ? tglTh(p.deadline) : null,
      sisa: p.deadline && p.aktif ? [lewatDeadline(p) ? "Terkunci" : labelDeadline(p.deadline)[0], labelDeadline(p.deadline)[1]] : null,
      status, kelas, persen: v, adaProgres, persenTeks: pct(v), defect: defectBaru[p.id] || 0,
    };
  });

  return (
    <main className="wrap">
      <DaftarProyek
        admin={admin}
        label={admin ? "Admin" : tukang ? "Tukang" : "Supervisor"}
        tautan={admin && (
          <Link href="/portal/bobot" className="act" aria-label="Bobot tahap" title="Bobot tahap" style={{ width: 48, padding: 0, flex: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
            </svg>
          </Link>
        )}
        kartu={kartu}
        kosong={admin ? "Belum ada proyek. Ketuk “+ Proyek baru” di atas untuk membuat yang pertama." : tukang ? `Belum ada item dengan tim tukang “${staf.nama}”.` : "Belum ada proyek."}
      >
        {admin && <ProyekBaru supervisors={supervisors} />}
      </DaftarProyek>
    </main>
  );
}
