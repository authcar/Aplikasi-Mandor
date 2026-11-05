"use client";
import { useEffect, useRef, useState } from "react";

// Matriks absensi pegawai: satu baris per orang, satu kolom per tanggal.
// Satu layar bisa memuat 11 orang sekaligus; ketuk sel untuk melihat jam &
// alamat. Data disusun di server (components/RekapAbsensiPegawai.jsx).
//
// Warna sel: hijau = masuk tepat waktu, merah = terlambat, abu = tidak ada
// absen. Titik oranye di pojok = hari yang sudah lewat tanpa absen pulang.
// Tidak ada "alpha": aplikasi tidak tahu hari libur, jadi hari kosong cuma
// ditampilkan netral.

const tglPanjang = (tanggal) =>
  new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

const peta = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

export default function MatriksAbsensi({ hari, pegawai, sel, ringkas, hariIni }) {
  const [pilih, setPilih] = useState(null); // { id, tanggal }
  const gulirRef = useRef(null);

  // Bulan berjalan: gulir supaya kolom hari ini kelihatan.
  useEffect(() => {
    const el = gulirRef.current?.querySelector("[data-hari-ini]");
    if (el && gulirRef.current) gulirRef.current.scrollLeft = Math.max(0, el.offsetLeft - 140);
  }, []);

  const detail = pilih ? sel[`${pilih.id}|${pilih.tanggal}`] : null;
  const namaPilih = pilih ? pegawai.find((p) => p.id === pilih.id)?.name : null;

  return (
    <div>
      <div ref={gulirRef} className="card overflow-x-auto">
        <table className="border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[116px] bg-white px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Nama
              </th>
              {hari.map((h) => (
                <th
                  key={h.tanggal}
                  {...(h.tanggal === hariIni ? { "data-hari-ini": true } : {})}
                  className={`min-w-[28px] px-0.5 py-1.5 text-[10px] font-semibold leading-tight ${
                    h.tanggal === hariIni ? "text-brand" : h.akhirPekan ? "text-gray-300" : "text-gray-500"
                  }`}
                >
                  <div className="text-[9px] font-medium">{h.hurufHari}</div>
                  <div>{h.d}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pegawai.map((p) => {
              const s = ringkas[p.id];
              return (
                <tr key={p.id}>
                  <td className="sticky left-0 z-10 border-t border-gray-100 bg-white px-3 py-1.5 text-left">
                    <p className="max-w-[104px] truncate text-xs font-semibold text-gray-700">{p.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {s?.hadir || 0} hadir
                      {s?.telat > 0 && <span className="font-bold text-red-600"> · {s.telat} telat</span>}
                    </p>
                  </td>
                  {hari.map((h) => {
                    const r = sel[`${p.id}|${h.tanggal}`];
                    const dipilih = pilih?.id === p.id && pilih.tanggal === h.tanggal;
                    const tanpaPulang = r && !r.keluar && h.tanggal < hariIni;
                    return (
                      <td
                        key={h.tanggal}
                        className={`border-t border-gray-100 px-0.5 py-1.5 ${h.akhirPekan ? "bg-gray-50" : ""}`}
                      >
                        {r ? (
                          <button
                            type="button"
                            onClick={() => setPilih({ id: p.id, tanggal: h.tanggal })}
                            aria-label={`${p.name}, ${h.tanggal}, masuk ${r.masuk}${r.telat ? ", terlambat" : ""}`}
                            className={`relative mx-auto block h-5 w-5 rounded-md ${
                              r.telat ? "bg-red-500" : "bg-green-500"
                            } ${dipilih ? "ring-2 ring-gray-800 ring-offset-1" : ""}`}
                          >
                            {tanpaPulang && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-amber-400" />
                            )}
                          </button>
                        ) : (
                          <span className="mx-auto block h-1 w-1 rounded-full bg-gray-200" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-gray-500">
        <Legenda warna="bg-green-500">Tepat waktu</Legenda>
        <Legenda warna="bg-red-500">Terlambat</Legenda>
        <Legenda warna="bg-amber-400" bulat>Tanpa absen pulang</Legenda>
      </div>

      {/* Detail sel yang diketuk */}
      <div className="card mt-3 p-3.5 text-sm">
        {!detail ? (
          <p className="text-center text-xs text-gray-400">Ketuk kotak berwarna untuk melihat jam dan lokasi.</p>
        ) : (
          <>
            <p className="font-bold text-gray-700">{namaPilih}</p>
            <p className="mb-2 text-xs capitalize text-gray-500">{tglPanjang(pilih.tanggal)}</p>
            <Baris
              judul="Masuk"
              jam={detail.masuk}
              badge={detail.telat ? ["Terlambat", "bg-red-100 text-red-700"] : ["Tepat waktu", "bg-green-100 text-green-700"]}
              teks={detail.alamatMasuk || detail.lokasiMasuk}
              lat={detail.latMasuk}
              lng={detail.lngMasuk}
            />
            {detail.keluar ? (
              <Baris
                judul="Pulang"
                jam={detail.keluar}
                badge={detail.cepat ? ["Lebih awal", "bg-amber-100 text-amber-700"] : null}
                teks={detail.alamatKeluar || detail.lokasiKeluar}
                lat={detail.latKeluar}
                lng={detail.lngKeluar}
                total={detail.total}
              />
            ) : (
              <p className="mt-2 text-xs text-gray-400">
                {pilih.tanggal < hariIni ? "Tidak absen pulang." : "Belum absen pulang."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Legenda({ warna, bulat, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block ${bulat ? "h-2 w-2 rounded-full" : "h-2.5 w-2.5 rounded-sm"} ${warna}`} />
      {children}
    </span>
  );
}

function Baris({ judul, jam, badge, teks, lat, lng, total }) {
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-700">
          {judul} <span className="tabular-nums">{jam}</span>
          {total && total !== "--:--" && <span className="text-xs font-normal text-gray-400"> · {total} jam</span>}
        </p>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge[1]}`}>{badge[0]}</span>}
      </div>
      <a href={peta(lat, lng)} target="_blank" rel="noreferrer" className="mt-0.5 block text-xs text-brand underline">
        {teks || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`}
      </a>
    </div>
  );
}
