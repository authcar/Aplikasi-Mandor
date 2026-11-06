"use client";
import { useEffect, useRef, useState } from "react";
import KotaGlow from "@/app/(portal)/portal/proyek/[id]/KotaGlow";

// Pop up loading "kota garis" yang sama dengan Project Tracker, dipasang sekali
// di layout dan muncul otomatis selama permintaan TULIS ke /api/* masih berjalan
// (kirim laporan, absen, persetujuan, dst.), tanpa perlu dipasang di tiap form.
//
// Cara kerja: window.fetch dibungkus; permintaan same-origin ke /api/* dengan
// metode selain GET/HEAD dihitung. Pop up baru tampil setelah JEDA_MS (aksi
// cepat tidak berkedip), lalu tetap tampil minimal TAMPIL_MIN_MS dan hilang
// begitu semua permintaan selesai. Ketuk kartunya untuk menyembunyikan (proses
// tetap jalan).
const JEDA_MS = 250;
const TAMPIL_MIN_MS = 500;

// Permintaan latar belakang / senyap: tidak boleh memunculkan pop up. Autosave
// Man Power (tiap jeda ketikan), detak lokasi kunjungan, notifikasi, sinkron
// Drive, dan langganan push dikirim tanpa orangnya menunggu.
const SENYAP = [
  "/api/laporan-harian/manpower",
  "/api/kunjungan/pantau",
  "/api/notify",
  "/api/perbaikan/notify-bukti",
  "/api/perbaikan/notify-review",
  "/api/drive-sync",
  "/api/push/",
];

const KETERANGAN_UMUM = ["Menyimpan perubahan", "Merapikan data", "Hampir selesai"];
const KETERANGAN_KHUSUS = [
  ["/api/absensi-pegawai", "Mencatat absensi"],
  ["/api/absensi", "Menyimpan absensi"],
  ["/api/laporan-harian", "Mengirim laporan"],
  ["/api/keuangan", "Mengirim pengajuan"],
  ["/api/approval", "Memproses persetujuan"],
  ["/api/kunjungan", "Mencatat kunjungan"],
  ["/api/masalah", "Menyimpan laporan masalah"],
  ["/api/tukang-login", "Masuk"],
  ["/api/login", "Masuk"],
];

function bacaPermintaan(input, init) {
  try {
    const url = new URL(typeof input === "string" ? input : input?.url || String(input), window.location.href);
    const metode = String(init?.method || (typeof input === "object" ? input?.method : "") || "GET").toUpperCase();
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return null;
    if (metode === "GET" || metode === "HEAD") return null;
    if (SENYAP.some((p) => url.pathname.startsWith(p))) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export default function MemuatGlobal() {
  const [tampil, setTampil] = useState(false);
  const [sembunyi, setSembunyi] = useState(false);
  const [tetap, setTetap] = useState(null); // keterangan khusus untuk permintaan pertama
  const [n, setN] = useState(0);
  const status = useRef({ berjalan: 0, jeda: null, sejak: 0, tutup: null });

  useEffect(() => {
    const asli = window.fetch;
    const s = status.current;

    const mulai = (path) => {
      clearTimeout(s.tutup);
      if (s.berjalan++ === 0) {
        setSembunyi(false);
        setTetap(KETERANGAN_KHUSUS.find(([p]) => path.startsWith(p))?.[1] || null);
        s.jeda = setTimeout(() => {
          s.sejak = Date.now();
          setTampil(true);
        }, JEDA_MS);
      }
    };
    const selesai = () => {
      if (--s.berjalan > 0) return;
      clearTimeout(s.jeda);
      if (!s.sejak) return;
      const sisa = Math.max(0, TAMPIL_MIN_MS - (Date.now() - s.sejak));
      s.tutup = setTimeout(() => {
        s.sejak = 0;
        setTampil(false);
      }, sisa);
    };

    window.fetch = function (input, init) {
      const path = bacaPermintaan(input, init);
      if (!path) return asli.apply(this, arguments);
      mulai(path);
      return asli.apply(this, arguments).finally(selesai);
    };
    return () => {
      window.fetch = asli;
      clearTimeout(s.jeda);
      clearTimeout(s.tutup);
    };
  }, []);

  useEffect(() => {
    if (!tampil) return undefined;
    const t = setInterval(() => setN((x) => (x + 1) % KETERANGAN_UMUM.length), 1800);
    return () => clearInterval(t);
  }, [tampil]);

  if (!tampil || sembunyi) return null;
  return (
    <div className="mk" role="status" aria-live="polite" onClick={() => setSembunyi(true)}>
      <div className="mk-kartu">
        <div className="mk-gbr">
          <KotaGlow />
        </div>
        <div className="mk-t">
          <span key={tetap || n} className="mk-ket">
            {tetap || KETERANGAN_UMUM[n]}
            <i className="mk-titik" aria-hidden="true" />
          </span>
          <span className="mk-bar" aria-hidden="true">
            <i />
          </span>
          <span className="mk-tip">Ketuk untuk menyembunyikan</span>
        </div>
      </div>
    </div>
  );
}
