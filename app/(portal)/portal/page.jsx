import Link from "next/link";
import DaftarProyek from "./DaftarProyek";
import { ambilStaf } from "@/lib/portal/server";
import { ambilBobotTahap, ambilItem, ambilItemMentah, ambilPengubahTerakhir, ambilProyekStaf, ambilTerminSemua, susunItem, timSaya } from "@/lib/portal/data";
import { hitungDefectBaru } from "@/lib/portal/defect";
import { syncPortalDariTaraco } from "@/lib/portal/syncTaraco";
import { persenProyek } from "@/lib/portal/progresBoq";
import { hariIni, tambahHari, tglTh, pct, statusProyek, statusBayar, labelDeadline, DEFECT_AKTIF } from "@/lib/portal/format";

export default async function PortalBeranda() {
  const { staf } = await ambilStaf();
  const admin = staf.role === "ADMIN";
  const tukang = staf.role === "TUKANG";
  // Proyek Taraco yang masuk kolom Production (pipeline Production) otomatis dibuatkan di Project Tracker.
  // Tidak ditunggu: sinkron ke Taraco (jaringan ke database lain) dulu memperlambat
  // tiap load per menit. Proyek baru muncul di load berikutnya; galat ditelan di dalamnya.
  if (!tukang) syncPortalDariTaraco().catch(() => {});
  // Admin/supervisor melihat semua proyek, jadi item semua proyek diminta berbarengan dengan
  // daftar proyeknya (satu bolak-balik ke database lebih sedikit). Tukang dan Head of Production
  // hanya sebagian proyek: item baru diambil sesudah daftarnya tahu.
  const berurutan = tukang || staf.peran === "HEAD_OF_PRODUCTION";
  const [proyek, mentah, bobot, defectBaru, pengubahSemua, termin] = await Promise.all([
    ambilProyekStaf(staf),
    berurutan ? null : ambilItemMentah(null),
    berurutan ? null : ambilBobotTahap(),
    tukang || admin || !DEFECT_AKTIF ? {} : hitungDefectBaru(),
    staf.peran === "MASTER" ? ambilPengubahTerakhir() : {},
    // Pembayaran hanya untuk admin: role lain tidak menerima datanya sama sekali.
    // Gagal baca -> kartu tampil tanpa label pembayaran.
    admin ? ambilTerminSemua().catch(() => null) : null,
  ]);
  const pengubah = pengubahSemua;
  const semuaItem = mentah ? susunItem(proyek, mentah, bobot) : await ambilItem(proyek);
  // Tukang: jumlah item dan progres dihitung dari item timnya saja.
  const items = semuaItem.filter((i) => !tukang || timSaya(staf, i));

  const hari = hariIni();
  const seninDari = (d) => tambahHari(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
  const seninIni = seninDari(hari);
  const sebelumSenin = tambahHari(seninIni, -1); // hari Minggu lalu
  // Laporan progres dikumpulkan Sabtu jam 12.00 WIB: peringatan "tidak ada progress"
  // baru muncul sesudah batas itu (Sabtu >= 12.00 dan Minggu), bukan sepanjang minggu.
  const sekarang = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const lewatBatas = sekarang.getDay() === 0 || (sekarang.getDay() === 6 && sekarang.getHours() >= 12);
  const kartu = proyek.map((p) => {
    const its = items.filter((i) => i.proyek_id === p.id);
    const v = persenProyek(its);
    const [status, kelas] = statusProyek({ ...p, items: its });
    // Minggu kerja Senin-Sabtu (Minggu libur) tempat proyek dibuat adalah minggu 1
    // dan belum dinilai; peringatan baru berlaku mulai minggu ke-2. Proyek yang
    // dibuat hari Minggu masuk minggu depannya.
    let masuk = p.created_at ? new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) : null;
    if (masuk && new Date(`${masuk}T00:00:00Z`).getUTCDay() === 0) masuk = tambahHari(masuk, 1);
    const mingguPertama = !!masuk && seninDari(masuk) >= seninIni;
    // Ada kenaikan progres sejak Senin minggu kalender ini?
    const adaProgres = mingguPertama || v - persenProyek(its, sebelumSenin) > 0.005;
    // Tanggal catatan progres terbaru di antara semua item proyek.
    const terakhir = its.flatMap((i) => Object.values(i.progres || {})).filter(Boolean).sort().pop() || null;
    return {
      id: p.id, kode: p.kode, klien: p.klien_nama, nama: p.nama, lokasi: p.lokasi, aktif: p.aktif,
      n: its.length, deadline: p.deadline ? tglTh(p.deadline) : null, kirim: p.tanggal_kirim ? tglTh(p.tanggal_kirim) : null,
      sisa: p.deadline && p.aktif ? labelDeadline(p.deadline) : null,
      bayar: termin ? statusBayar(termin[p.id] || [], v, status) : null,
      status, kelas, persen: v, adaProgres: adaProgres || !lewatBatas, terakhir: terakhir ? tglTh(terakhir) : null, persenTeks: pct(v), oleh: pengubah[p.id]?.oleh || null, defect: defectBaru[p.id] || 0,
    };
  });

  return (
    <main className="wrap">
      <DaftarProyek
        admin={admin}
        label={admin ? "Admin" : tukang ? "Pekerja" : "Supervisor"}
        tautan={admin && (
          <Link href="/portal/bobot" className="act" aria-label="Bobot tahap" title="Bobot tahap" style={{ width: 48, padding: 0, flex: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
            </svg>
          </Link>
        )}
        kartu={kartu}
        kosong={admin ? "Belum ada proyek. Proyek muncul di sini otomatis begitu BoQ-nya diunggah dari website Taraco Project Management." : tukang ? `Belum ada item dengan tim pekerja “${staf.nama}”.` : "Belum ada proyek."}
      />
    </main>
  );
}
