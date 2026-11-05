import Link from "next/link";
import BackButton from "@/components/BackButton";
import MatriksAbsensi from "@/components/MatriksAbsensi";
import UnduhPdfAbsensi from "@/components/UnduhPdfAbsensi";
import {
  tanggalWIB,
  formatJam,
  durasiKerja,
  rentangBulan,
  bulanValid,
  NAMA_BULAN,
} from "@/lib/absensiPegawaiAturan";

// Rekap absensi pegawai untuk MASTER & FINANCE, dibuat ringkas untuk ~11 orang:
// ringkasan hari ini, lalu matriks orang × tanggal satu bulan (ketuk sel untuk
// detail), lalu tombol unduh PDF berisi foto selfie bulan itu. Dipakai bersama
// oleh /master/absensi-pegawai dan /finance/absensi-pegawai.
//
// "Tidak absen pulang" TIDAK disimpan; dihitung dari baris yang tanggalnya
// sudah lewat tapi keluar_at masih kosong. Jadi tidak butuh penjadwal untuk
// menutup hari yang terlewat.

const HURUF_HARI = ["M", "S", "S", "R", "K", "J", "S"]; // Minggu … Sabtu

function geserBulan(bulan, delta) {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const KOLOM_DASAR =
  "profile_id, tanggal, masuk_at, keluar_at, lat_masuk, lng_masuk, lokasi_masuk, lat_keluar, lng_keluar, lokasi_keluar, terlambat, pulang_cepat";

export default async function RekapAbsensiPegawai({ supabase, basePath, homePath, bulanParam }) {
  const hariIni = tanggalWIB();
  const bulanIni = hariIni.slice(0, 7);
  const bulan = bulanValid(bulanParam) ? bulanParam : bulanIni;
  const [yr, mo] = bulan.split("-").map(Number);
  const { awal, akhir, jumlahHari } = rentangBulan(bulan);

  const ambilRows = (kolom) =>
    supabase.from("absensi_pegawai").select(kolom).gte("tanggal", awal).lt("tanggal", akhir).order("masuk_at");

  const [{ data: pegawai }, hasil] = await Promise.all([
    supabase.from("profiles").select("id, name, role").eq("wajib_absen", true).order("name"),
    // Kolom alamat baru ada setelah add_absensi_pegawai_foto.sql dijalankan;
    // kalau belum, jatuh ke kolom dasar supaya halaman tetap tampil.
    ambilRows(`${KOLOM_DASAR}, alamat_masuk, alamat_keluar`),
  ]);
  const rows = hasil.error ? (await ambilRows(KOLOM_DASAR)).data || [] : hasil.data || [];

  // Ringkas per orang + peta sel "profile|tanggal" untuk matriks.
  const ringkas = {};
  const sel = {};
  for (const r of rows) {
    const s = (ringkas[r.profile_id] ||= { hadir: 0, telat: 0 });
    s.hadir += 1;
    if (r.terlambat) s.telat += 1;
    sel[`${r.profile_id}|${r.tanggal}`] = {
      masuk: formatJam(r.masuk_at),
      keluar: r.keluar_at ? formatJam(r.keluar_at) : null,
      total: durasiKerja(r.masuk_at, r.keluar_at),
      telat: !!r.terlambat,
      cepat: !!r.pulang_cepat,
      lokasiMasuk: r.lokasi_masuk || null,
      alamatMasuk: r.alamat_masuk || null,
      latMasuk: r.lat_masuk,
      lngMasuk: r.lng_masuk,
      lokasiKeluar: r.lokasi_keluar || null,
      alamatKeluar: r.alamat_keluar || null,
      latKeluar: r.lat_keluar,
      lngKeluar: r.lng_keluar,
    };
  }

  const hari = Array.from({ length: jumlahHari }, (_, i) => {
    const d = i + 1;
    const dow = new Date(Date.UTC(yr, mo - 1, d)).getUTCDay();
    return {
      d,
      tanggal: `${bulan}-${String(d).padStart(2, "0")}`,
      hurufHari: HURUF_HARI[dow],
      akhirPekan: dow === 0 || dow === 6,
    };
  });

  // Ringkasan hari ini
  const daftar = pegawai || [];
  const hariIniPer = Object.fromEntries(
    rows.filter((r) => r.tanggal === hariIni).map((r) => [r.profile_id, r])
  );
  const sudahMasuk = daftar.filter((p) => hariIniPer[p.id]);
  const belum = daftar.filter((p) => !hariIniPer[p.id]);
  const telatHariIni = sudahMasuk.filter((p) => hariIniPer[p.id].terlambat).length;

  return (
    <main className="p-4 pb-8">
      <BackButton href={homePath} />
      <h1 className="text-xl font-bold tracking-tight">Absensi Pegawai</h1>
      <p className="mb-4 text-sm text-gray-500">Jam masuk, pulang, dan lokasi. Foto selfie ada di PDF bulanan.</p>

      {daftar.length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-400">
          Belum ada akun yang ditandai wajib absen. Jalankan supabase/seed_wajib_absen.sql.
        </div>
      ) : (
        <>
          {/* Hari ini */}
          <div className="card mb-4 p-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-gray-700">Hari ini</h2>
              <p className="text-xs text-gray-500">
                <span className="font-bold text-green-600">{sudahMasuk.length}</span> sudah masuk
                {telatHariIni > 0 && <span className="font-bold text-red-600"> · {telatHariIni} telat</span>}
                {" · "}
                <span className="font-bold text-gray-700">{belum.length}</span> belum
              </p>
            </div>
            {belum.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {belum.map((p) => (
                  <span key={p.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Navigasi bulan */}
          <div className="mb-2 flex items-center justify-between">
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

          <MatriksAbsensi hari={hari} pegawai={daftar} sel={sel} ringkas={ringkas} hariIni={hariIni} />

          <div className="mt-4">
            <UnduhPdfAbsensi bulan={bulan} sementara={bulan === bulanIni} kosong={rows.length === 0} />
          </div>
        </>
      )}
    </main>
  );
}
