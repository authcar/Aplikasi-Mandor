"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { bolehKoreksiLaporan } from "@/lib/laporanKoreksi";
import KoreksiLaporan from "./KoreksiLaporan";
import { NAMA_BULAN, rentangBulan } from "@/lib/absensiPegawaiAturan";

const STATUS_BADGE = {
  ON_PROGRESS: { label: "Sedang Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  DONE: { label: "Selesai", cls: "bg-green-100 text-green-700" },
  PERBAIKAN: { label: "Perlu Perbaikan", cls: "bg-red-100 text-red-700" },
};

// Semua URL foto satu kegiatan (baris lama / halaman yang belum mengirim daftar: cuma fotoSignedUrl).
const semuaFoto = (it) => (it.fotoSignedUrls?.length ? it.fotoSignedUrls : it.fotoSignedUrl ? [it.fotoSignedUrl] : []);

const labelTanggal = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const jamnya = (ts) =>
  new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// Kelompokkan flat list riwayat -> per hari -> per proyek (asumsi input
// sudah terurut tanggal desc lalu created_at desc, jadi cukup grouping
// berdasarkan baris bersebelahan, sama seperti groupAbsensiTimPerHari).
function kelompokkan(riwayat) {
  const perHari = [];
  for (const r of riwayat) {
    const lastHari = perHari[perHari.length - 1];
    const hari = lastHari && lastHari.tanggal === r.tanggal ? lastHari : (perHari.push({ tanggal: r.tanggal, proyekGrup: [] }), perHari[perHari.length - 1]);
    const nama = r.proyek?.nama || "—";
    const grup = hari.proyekGrup.find((g) => g.nama === nama);
    if (grup) grup.items.push(r);
    else hari.proyekGrup.push({ nama, proyekId: r.proyek_id, items: [r] });
  }
  return perHari;
}

// Tombol unduh PDF laporan satu proyek pada satu hari. Pakai fetch (bukan
// link langsung) supaya galat dari server tampil di tempat, bukan halaman JSON.
function TombolPdf({ proyekId, tanggal }) {
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);

  const unduh = async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/laporan-harian/pdf?proyek_id=${proyekId}&tanggal=${tanggal}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal membuat PDF.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] ||
        `Laporan Harian ${tanggal}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={unduh}
        disabled={memuat}
        aria-label="Unduh PDF laporan"
        className="flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand active:opacity-70 disabled:opacity-50"
      >
        <Icon name="download" className="h-3.5 w-3.5" />
        {memuat ? "Membuat…" : "PDF"}
      </button>
      {galat && <p className="basis-full pb-1 text-[11px] text-red-600">{galat}</p>}
    </>
  );
}

// Hapus semua kegiatan satu proyek pada satu hari. Hanya tampil kalau ada
// kegiatan yang boleh dihapus pemakainya; server menyaring ulang izinnya.
function TombolHapusSemua({ proyekId, tanggal, nama, dapatDihapus, onTerhapus }) {
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);
  if (!dapatDihapus.length) return null;

  const hapus = async () => {
    const n = dapatDihapus.length;
    if (!confirm(`Hapus ${n} kegiatan ${nama} tanggal ${labelTanggal(tanggal)} beserta semua fotonya? Tindakan ini tidak bisa dibatalkan.`)) return;
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch("/api/laporan-harian/hapus-hari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyek_id: proyekId, tanggal }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal menghapus.");
      onTerhapus(j.ids || []);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={hapus}
        disabled={memuat}
        aria-label="Hapus semua kegiatan proyek ini di hari ini"
        title="Hapus semua kegiatan hari ini"
        className="ml-1.5 flex shrink-0 items-center justify-center rounded-full bg-red-50 p-1.5 text-red-600 active:opacity-70 disabled:opacity-50"
      >
        <Icon name="trash-2" className={`h-3.5 w-3.5 ${memuat ? "animate-pulse" : ""}`} />
      </button>
      {galat && <p className="basis-full pb-1 text-[11px] text-red-600">{galat}</p>}
    </>
  );
}

const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function geserBulan(bulan, delta) {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Kalender satu bulan: tanggal yang punya laporan diberi angka jumlahnya dan
// bisa diketuk (membuka pop-up daftar proyek hari itu). Pindah bulan lewat
// ?bulan= supaya server hanya memuat laporan bulan itu.
function KalenderBulan({ bulan, basePath, hariIni, perHari, onPilih }) {
  const [y, m] = bulan.split("-").map(Number);
  const { jumlahHari } = rentangBulan(bulan);
  const kosongAwal = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Senin = 0
  const perTanggal = new Map(perHari.map((h) => [h.tanggal, h]));
  const totalBulan = perHari.reduce((s, h) => s + h.proyekGrup.reduce((a, p) => a + p.items.length, 0), 0);
  const bisaMaju = bulan < hariIni.slice(0, 7);

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <Link href={`${basePath}?bulan=${geserBulan(bulan, -1)}`} className="px-3 py-1 text-lg font-semibold text-brand">
          ‹
        </Link>
        <div className="text-center">
          <p className="font-bold text-gray-700">{NAMA_BULAN[m - 1]} {y}</p>
          <p className="text-[11px] text-gray-400">{totalBulan} laporan · ketuk tanggal untuk melihat</p>
        </div>
        {bisaMaju ? (
          <Link href={`${basePath}?bulan=${geserBulan(bulan, 1)}`} className="px-3 py-1 text-lg font-semibold text-brand">
            ›
          </Link>
        ) : (
          <span className="px-3 py-1 text-lg text-gray-300">›</span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {NAMA_HARI.map((n) => (
          <span key={n} className="pb-1 text-[10px] font-semibold uppercase text-gray-400">{n}</span>
        ))}
        {Array.from({ length: kosongAwal }, (_, i) => <span key={`k${i}`} />)}
        {Array.from({ length: jumlahHari }, (_, i) => {
          const d = i + 1;
          const tgl = `${bulan}-${String(d).padStart(2, "0")}`;
          const h = perTanggal.get(tgl);
          const total = h ? h.proyekGrup.reduce((a, p) => a + p.items.length, 0) : 0;
          const ring = tgl === hariIni ? "ring-2 ring-brand" : "";
          if (!h) {
            return (
              <span key={tgl} className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm text-gray-400 ${ring}`}>
                {d}
              </span>
            );
          }
          return (
            <button
              key={tgl}
              type="button"
              onClick={() => onPilih(tgl)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl bg-brand/10 text-sm font-bold text-brand active:opacity-70 ${ring}`}
            >
              {d}
              <span className="text-[10px] font-semibold leading-none">{total}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Riwayat Laporan Harian — dikelompokkan hari > dropdown proyek > baris
// ringkas, ketuk baris untuk lihat detail (foto + deskripsi penuh).
// `peran` + `userId` (opsional) mengaktifkan Edit/Hapus di detail untuk yang
// berhak: Master semua laporan, Supervisor hanya miliknya (kapan saja)
// (aturan: lib/laporanKoreksi.js; izin sebenarnya dicek di server).
// `kalender` + `bulan` + `basePath` + `hariIni` menampilkan kalender bulanan
// (ketuk tanggal -> pop-up proyek) sebagai pengganti daftar per hari.
export default function RiwayatLaporanHarianCard({
  riwayat: riwayatAsli = [],
  peran = null,
  userId = null,
  kalender = false,
  bulan = null,
  basePath = null,
  hariIni = null,
}) {
  const router = useRouter();
  // Hasil koreksi dipakai langsung di sini (id -> perubahan, atau null = terhapus),
  // karena sebagian halaman menyimpan daftarnya sendiri dan tidak ikut refresh.
  const [koreksi, setKoreksi] = useState({});
  const riwayat = riwayatAsli.filter((r) => koreksi[r.id] !== null).map((r) => (koreksi[r.id] ? { ...r, ...koreksi[r.id] } : r));
  const perHari = kelompokkan(riwayat);
  const [openHari, setOpenHari] = useState(perHari[0]?.tanggal ?? null);
  const [openProyek, setOpenProyek] = useState(null); // `${tanggal}|${nama}`
  const [hariDipilih, setHariDipilih] = useState(null); // tanggal yang dibuka di kalender
  const [detailId, setDetailId] = useState(null);
  const [mengedit, setMengedit] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [galat, setGalat] = useState("");
  const detail = riwayat.find((r) => r.id === detailId) || null;
  const setDetail = (it) => {
    setDetailId(it?.id ?? null);
    setMengedit(false);
    setGalat("");
  };
  const boleh = !!detail && bolehKoreksiLaporan({ peran, userId, laporan: detail });

  const hapus = async () => {
    if (!confirm("Hapus kegiatan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    setMenghapus(true);
    setGalat("");
    try {
      const res = await fetch(`/api/laporan-harian/${detail.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal menghapus.");
      setKoreksi((k) => ({ ...k, [detail.id]: null }));
      setDetail(null);
      router.refresh();
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMenghapus(false);
    }
  };

  if (!riwayatAsli.length && !kalender) return null;

  const pilihHari = (tgl) => {
    const h = perHari.find((x) => x.tanggal === tgl);
    setHariDipilih(tgl);
    // Satu proyek saja di hari itu: langsung buka daftar kegiatannya.
    setOpenProyek(h && h.proyekGrup.length === 1 ? `${tgl}|${h.proyekGrup[0].nama}` : null);
  };
  const hariData = kalender ? perHari.find((x) => x.tanggal === hariDipilih) || null : null;

  const daftarProyekHari = (h) => (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {h.proyekGrup.map((p) => {
                    const key = `${h.tanggal}|${p.nama}`;
                    const proyekTerbuka = openProyek === key;
                    return (
                      <div key={key}>
                        <div className="flex flex-wrap items-center pr-3">
                        <button
                          type="button"
                          onClick={() => setOpenProyek((cur) => (cur === key ? null : key))}
                          className="flex min-w-0 flex-1 items-center justify-between px-4 py-2 active:bg-gray-50"
                        >
                          <span className="text-sm font-semibold text-gray-600">{p.nama}</span>
                          <span className="flex items-center gap-2 text-gray-400">
                            <span className="text-[11px]">{p.items.length} kegiatan</span>
                            <Icon name="chevron-down" className={`h-3 w-3 transition-transform ${proyekTerbuka ? "rotate-180" : ""}`} />
                          </span>
                        </button>
                        {p.proyekId && <TombolPdf proyekId={p.proyekId} tanggal={h.tanggal} />}
                        {p.proyekId && (
                          <TombolHapusSemua
                            proyekId={p.proyekId}
                            tanggal={h.tanggal}
                            nama={p.nama}
                            dapatDihapus={p.items.filter((it) => bolehKoreksiLaporan({ peran, userId, laporan: it }))}
                            onTerhapus={(ids) => {
                              setKoreksi((k) => ({ ...k, ...Object.fromEntries(ids.map((id) => [id, null])) }));
                              router.refresh();
                            }}
                          />
                        )}
                        </div>

                        {proyekTerbuka && (
                          <div className="space-y-1 bg-gray-50/60 px-4 pb-2">
                            {p.items.map((it) => {
                              const badge = STATUS_BADGE[it.status] || STATUS_BADGE.ON_PROGRESS;
                              return (
                                <button
                                  key={it.id}
                                  type="button"
                                  onClick={() => setDetail(it)}
                                  className="flex w-full items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-left active:bg-gray-100"
                                >
                                  {it.fotoSignedUrl ? (
                                    <span className="relative h-9 w-9 shrink-0">
                                      <img src={it.fotoSignedUrl} alt="" className="h-9 w-9 rounded-md border border-gray-200 object-cover" />
                                      {semuaFoto(it).length > 1 && (
                                        <span className="absolute -bottom-1 -right-1 rounded-full bg-gray-700 px-1 text-[9px] font-bold leading-4 text-white">
                                          {semuaFoto(it).length}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-300">
                                      <Icon name="camera" className="h-4 w-4" />
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-gray-700">{it.deskripsi}</span>
                                    <span className="text-[10px] text-gray-400">{jamnya(it.created_at)}</span>
                                  </span>
                                  <span className={`badge shrink-0 !text-[10px] ${badge.cls}`}>{badge.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
  );

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-bold text-gray-700">Riwayat Laporan Harian</h2>
      {kalender && (
        <KalenderBulan bulan={bulan} basePath={basePath} hariIni={hariIni} perHari={perHari} onPilih={pilihHari} />
      )}
      <div className={kalender ? "hidden" : "space-y-2"}>
        {!kalender && perHari.map((h) => {
          const totalHari = h.proyekGrup.reduce((s, p) => s + p.items.length, 0);
          const hariTerbuka = openHari === h.tanggal;
          return (
            <div key={h.tanggal} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHari((cur) => (cur === h.tanggal ? null : h.tanggal))}
                className="flex w-full items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm font-semibold capitalize text-gray-700">{labelTanggal(h.tanggal)}</span>
                <span className="flex items-center gap-2 text-gray-400">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                    {totalHari} laporan
                  </span>
                  <Icon name="chevron-down" className={`h-3.5 w-3.5 transition-transform ${hariTerbuka ? "rotate-180" : ""}`} />
                </span>
              </button>

              {hariTerbuka && daftarProyekHari(h)}
            </div>
          );
        })}
      </div>

      {hariData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setHariDipilih(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-semibold capitalize text-gray-800">{labelTanggal(hariData.tanggal)}</p>
                <p className="text-xs text-gray-400">
                  {hariData.proyekGrup.reduce((a, p) => a + p.items.length, 0)} laporan · {hariData.proyekGrup.length} proyek — pilih proyek
                </p>
              </div>
              <button onClick={() => setHariDipilih(null)} className="shrink-0 px-1 text-2xl leading-none text-gray-400">×</button>
            </div>
            <div className="overflow-y-auto">{daftarProyekHari(hariData)}</div>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{detail.proyek?.nama || "—"}</p>
                <p className="text-xs text-gray-400">
                  {labelTanggal(detail.tanggal)} · {jamnya(detail.created_at)}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 px-1 text-2xl leading-none text-gray-400">×</button>
            </div>
            {mengedit ? (
              <KoreksiLaporan
                laporan={detail}
                onBatal={() => setMengedit(false)}
                onSelesai={(patch) => {
                  setKoreksi((k) => ({ ...k, [detail.id]: patch }));
                  setMengedit(false);
                  router.refresh();
                }}
              />
            ) : (
              <>
                <span className={`badge mb-3 w-fit ${(STATUS_BADGE[detail.status] || STATUS_BADGE.ON_PROGRESS).cls}`}>
                  {(STATUS_BADGE[detail.status] || STATUS_BADGE.ON_PROGRESS).label}
                </span>
                {semuaFoto(detail).length > 0 && (
                  <div className={`mb-3 grid gap-2 overflow-y-auto ${semuaFoto(detail).length > 1 ? "max-h-[45vh] grid-cols-2" : ""}`}>
                    {semuaFoto(detail).map((u, n) => (
                      <img
                        key={u}
                        src={u}
                        alt={`dokumentasi ${n + 1}`}
                        className={`w-full rounded-xl border border-gray-200 ${
                          semuaFoto(detail).length > 1 ? "aspect-square object-cover" : "max-h-[45vh] object-contain"
                        }`}
                      />
                    ))}
                  </div>
                )}
                <p className="overflow-y-auto text-sm text-gray-700">{detail.deskripsi}</p>
                {galat && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{galat}</p>}
                {boleh && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMengedit(true)}
                      disabled={menghapus}
                      className="flex-1 rounded-xl bg-brand/10 py-2.5 text-sm font-semibold text-brand active:opacity-70 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={hapus}
                      disabled={menghapus}
                      className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-600 active:opacity-70 disabled:opacity-50"
                    >
                      {menghapus ? "Menghapus…" : "Hapus"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
