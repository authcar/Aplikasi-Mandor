import Link from "next/link";
import BackButton from "@/components/BackButton";
import {
  tanggalWIB,
  formatJam,
  durasiKerja,
  tautanPeta,
} from "@/lib/absensiPegawaiAturan";

// Rekap absensi pegawai untuk MASTER & FINANCE: status hari ini per orang +
// riwayat clock in/out dan lokasi per bulan. Dipakai bersama oleh
// /master/absensi-pegawai dan /finance/absensi-pegawai.
//
// "Tidak absen pulang" TIDAK disimpan; dihitung di sini dari baris yang
// tanggalnya sudah lewat tapi keluar_at masih kosong. Jadi tidak butuh
// penjadwal untuk menutup hari yang terlewat.

const NAMA_BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function geserBulan(bulan, delta) {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const tglPendek = (tanggal) =>
  new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  });

export default async function RekapAbsensiPegawai({ supabase, basePath, homePath, bulanParam }) {
  const hariIni = tanggalWIB();
  const bulanIni = hariIni.slice(0, 7);
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(bulanParam || "") ? bulanParam : bulanIni;
  const [yr, mo] = bulan.split("-").map(Number);
  const awal = `${bulan}-01`;
  const akhir = `${geserBulan(bulan, 1)}-01`;

  const [{ data: pegawai }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, name, role").eq("wajib_absen", true).order("name"),
    supabase
      .from("absensi_pegawai")
      .select(
        "profile_id, tanggal, masuk_at, keluar_at, lat_masuk, lng_masuk, lokasi_masuk, lat_keluar, lng_keluar, lokasi_keluar, terlambat, pulang_cepat"
      )
      .gte("tanggal", awal)
      .lt("tanggal", akhir)
      .order("tanggal", { ascending: false })
      .order("masuk_at"),
  ]);

  const nama = Object.fromEntries((pegawai || []).map((p) => [p.id, p.name]));
  const baris = rows || [];
  const absenHariIni = Object.fromEntries(baris.filter((r) => r.tanggal === hariIni).map((r) => [r.profile_id, r]));

  const ringkas = {};
  for (const r of baris) {
    const s = (ringkas[r.profile_id] ||= { hadir: 0, telat: 0, tanpaPulang: 0 });
    s.hadir += 1;
    if (r.terlambat) s.telat += 1;
    if (!r.keluar_at && r.tanggal < hariIni) s.tanpaPulang += 1;
  }

  // Kelompokkan riwayat per tanggal
  const perHari = [];
  for (const r of baris) {
    const last = perHari[perHari.length - 1];
    if (last && last.tanggal === r.tanggal) last.items.push(r);
    else perHari.push({ tanggal: r.tanggal, items: [r] });
  }

  return (
    <main className="p-4 pb-8">
      <BackButton href={homePath} />
      <h1 className="text-xl font-bold tracking-tight">Absensi Pegawai</h1>
      <p className="mb-4 text-sm text-gray-500">Jam masuk, pulang, dan lokasi. Foto selfie tidak disimpan.</p>

      {/* Hari ini */}
      <h2 className="mb-2 font-bold text-gray-700">Hari ini</h2>
      {(pegawai || []).length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-400">
          Belum ada akun yang ditandai wajib absen. Jalankan supabase/seed_wajib_absen.sql.
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {pegawai.map((p) => {
            const r = absenHariIni[p.id];
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium text-gray-700">{p.name}</span>
                {!r ? (
                  <span className="shrink-0 text-xs font-bold text-gray-400">Belum absen</span>
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-gray-600">
                    <span className={r.terlambat ? "font-bold text-red-600" : "font-bold text-green-600"}>
                      {formatJam(r.masuk_at)}
                    </span>
                    {" – "}
                    {r.keluar_at ? formatJam(r.keluar_at) : "…"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Navigasi bulan */}
      <div className="mb-2 mt-6 flex items-center justify-between">
        <Link href={`${basePath}?bulan=${geserBulan(bulan, -1)}`} className="px-2 py-1 text-sm font-semibold text-brand">
          ‹ Sebelumnya
        </Link>
        <h2 className="font-bold text-gray-700">{NAMA_BULAN[mo - 1]} {yr}</h2>
        {bulan < bulanIni ? (
          <Link href={`${basePath}?bulan=${geserBulan(bulan, 1)}`} className="px-2 py-1 text-sm font-semibold text-brand">
            Berikutnya ›
          </Link>
        ) : (
          <span className="px-2 py-1 text-sm text-gray-300">Berikutnya ›</span>
        )}
      </div>

      {/* Rekap per orang */}
      {Object.keys(ringkas).length > 0 && (
        <div className="card mb-3 divide-y divide-gray-100">
          {(pegawai || [])
            .filter((p) => ringkas[p.id])
            .map((p) => {
              const s = ringkas[p.id];
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                  <span className="min-w-0 truncate text-sm font-medium text-gray-700">{p.name}</span>
                  <span className="flex shrink-0 gap-2 text-gray-500">
                    <span>{s.hadir} hadir</span>
                    {s.telat > 0 && <span className="font-bold text-red-600">{s.telat} telat</span>}
                    {s.tanpaPulang > 0 && <span className="font-bold text-amber-600">{s.tanpaPulang} tanpa pulang</span>}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Riwayat harian */}
      {perHari.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">Belum ada absensi bulan ini.</div>
      ) : (
        <div className="space-y-3">
          {perHari.map((h) => (
            <div key={h.tanggal} className="card overflow-hidden">
              <p className="border-b border-gray-100 px-4 py-2 text-xs font-bold capitalize text-gray-500">
                {tglPendek(h.tanggal)}
              </p>
              <ul className="divide-y divide-gray-50">
                {h.items.map((r) => {
                  const tanpaPulang = !r.keluar_at && r.tanggal < hariIni;
                  return (
                    <li key={r.profile_id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-gray-700">
                          {nama[r.profile_id] || "—"}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-gray-600">
                          {formatJam(r.masuk_at)} – {formatJam(r.keluar_at)} · {durasiKerja(r.masuk_at, r.keluar_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.terlambat && <Badge warna="bg-red-100 text-red-700">Terlambat</Badge>}
                        {r.pulang_cepat && <Badge warna="bg-amber-100 text-amber-700">Pulang cepat</Badge>}
                        {tanpaPulang && <Badge warna="bg-gray-100 text-gray-600">Tidak absen pulang</Badge>}
                      </div>
                      <div className="mt-1 space-y-0.5 text-[11px] text-gray-400">
                        <Lokasi label="Masuk" lat={r.lat_masuk} lng={r.lng_masuk} proyek={r.lokasi_masuk} />
                        {r.keluar_at && (
                          <Lokasi label="Pulang" lat={r.lat_keluar} lng={r.lng_keluar} proyek={r.lokasi_keluar} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Badge({ warna, children }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${warna}`}>{children}</span>;
}

function Lokasi({ label, lat, lng, proyek }) {
  return (
    <p>
      {label}:{" "}
      <a href={tautanPeta(lat, lng)} target="_blank" rel="noreferrer" className="text-brand underline">
        {proyek || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
      </a>
    </p>
  );
}
