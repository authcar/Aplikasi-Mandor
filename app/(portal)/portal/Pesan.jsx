"use client";
import { useEffect, useState } from "react";
import KotaGlow from "./proyek/[id]/KotaGlow";

// Pop up loading selama aksi berjalan dan data baru dimuat, lalu pesan hasil
// aksi yang melayang di atas navigasi bawah supaya tetap terlihat walau sedang
// menggulir jauh. Ketuk pesan untuk menutup.
// Loading: kota garis yang tergambar sendiri, keterangan yang berganti, dan
// bilah yang berjalan. Ketuk kartunya untuk menyembunyikan (proses tetap jalan).
const KETERANGAN = ["Menyimpan perubahan", "Merapikan data", "Hampir selesai"];

function Memuat({ aksi }) {
  const [n, setN] = useState(0);
  const [sembunyi, setSembunyi] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x + 1) % KETERANGAN.length), 1800);
    return () => clearInterval(t);
  }, []);
  if (sembunyi) return null;
  return (
    <div className="memuat" role="status" aria-live="polite" onClick={() => setSembunyi(true)}>
      <div className="memuat-k memuat-kota">
        <div className="memuat-gbr"><KotaGlow /></div>
        <div className="memuat-t">
          <span key={aksi.memuat ? "m" : n} className="memuat-ket">{aksi.memuat ? "Memuat data terbaru" : KETERANGAN[n]}<i className="titik" aria-hidden="true" /></span>
          <span className="memuat-bar" aria-hidden="true"><i /></span>
          <span className="memuat-tip">Ketuk untuk menyembunyikan</span>
        </div>
      </div>
    </div>
  );
}

export default function Pesan({ aksi }) {
  const gagal = aksi.msg.startsWith("Gagal");
  return (
    <>
      {aksi.sibuk && <Memuat aksi={aksi} />}
      {aksi.msg && (
        <button type="button" className={`toast ${gagal ? "b-bad" : "b-ok"}`} role="status" onClick={() => aksi.setMsg("")}>
          {aksi.msg}
        </button>
      )}
    </>
  );
}
