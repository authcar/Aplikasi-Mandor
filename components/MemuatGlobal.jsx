"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import KotaGlow from "@/app/(portal)/portal/proyek/[id]/KotaGlow";

// Pop up loading "kota garis" yang sama dengan Project Tracker, dipasang sekali
// di layout. Muncul otomatis, tanpa perlu dipasang di tiap halaman/form, untuk
// dua hal:
//   1. PINDAH HALAMAN: mengetuk tautan internal (menu, tile dashboard, tab bar).
//      Pop up tampil sampai halaman tujuan selesai dimuat, yaitu kerangka
//      abu-abu (loading.jsx, kelas .skel) sudah diganti isi sebenarnya.
//   2. AKSI TULIS: permintaan same-origin ke /api/* dengan metode selain
//      GET/HEAD (kirim laporan, absen, persetujuan, dst.).
//
// Pop up baru tampil setelah JEDA_MS (aksi/halaman cepat tidak berkedip), lalu
// tetap tampil minimal TAMPIL_MIN_MS. Ketuk kartunya untuk menyembunyikan
// (proses tetap jalan).
const JEDA_MS = 250;
const TAMPIL_MIN_MS = 500;
const NAV_MAKS_MS = 12000; // pengaman: navigasi yang tidak pernah selesai (dibatalkan, gagal)
const CEK_SKELETON_MS = 80;

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
const KETERANGAN_NAV = "Memuat halaman";
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

// Tautan internal yang akan memindahkan halaman (bukan tab baru, unduhan, anchor, atau halaman yang sama).
function tujuanNavigasi(e) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  try {
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === window.location.pathname) return null; // mis. ganti bulan (?bulan=) cukup cepat
    return url.pathname;
  } catch {
    return null;
  }
}

export default function MemuatGlobal() {
  const pathname = usePathname();
  const [tampil, setTampil] = useState(false);
  const [sembunyi, setSembunyi] = useState(false);
  const [tetap, setTetap] = useState(null); // keterangan khusus untuk pekerjaan pertama
  const [n, setN] = useState(0);
  // berjalan = jumlah pekerjaan aktif (permintaan tulis + navigasi). Fungsi
  // mulai/selesai diisi di efek di bawah, dipakai juga oleh efek pathname.
  const s = useRef({ berjalan: 0, jeda: null, sejak: 0, tutup: null, nav: null, mulai: null, selesai: null });

  useEffect(() => {
    const st = s.current;

    st.mulai = (keterangan) => {
      clearTimeout(st.tutup);
      if (st.berjalan++ === 0) {
        setSembunyi(false);
        setTetap(keterangan);
        st.jeda = setTimeout(() => {
          st.sejak = Date.now();
          setTampil(true);
        }, JEDA_MS);
      }
    };
    st.selesai = () => {
      if (--st.berjalan > 0) return;
      clearTimeout(st.jeda);
      if (!st.sejak) return;
      const sisa = Math.max(0, TAMPIL_MIN_MS - (Date.now() - st.sejak));
      st.tutup = setTimeout(() => {
        st.sejak = 0;
        setTampil(false);
      }, sisa);
    };

    // --- aksi tulis ---
    const asli = window.fetch;
    window.fetch = function (input, init) {
      const path = bacaPermintaan(input, init);
      if (!path) return asli.apply(this, arguments);
      st.mulai(KETERANGAN_KHUSUS.find(([p]) => path.startsWith(p))?.[1] || null);
      return asli.apply(this, arguments).finally(st.selesai);
    };

    // --- pindah halaman ---
    // Fase capture: jalan sebelum handler Link milik Next. Navigasi dianggap
    // selesai oleh efek pathname di bawah (atau pengaman NAV_MAKS_MS).
    const akhiriNav = () => {
      if (!st.nav) return;
      clearTimeout(st.nav.pengaman);
      clearInterval(st.nav.cek);
      st.nav = null;
      st.selesai();
    };
    st.akhiriNav = akhiriNav;
    const klik = (e) => {
      const tujuan = tujuanNavigasi(e);
      if (!tujuan) return;
      if (st.nav) akhiriNav();
      st.nav = { tujuan, asal: window.location.pathname, pengaman: setTimeout(akhiriNav, NAV_MAKS_MS), cek: null };
      st.mulai(KETERANGAN_NAV);
    };
    document.addEventListener("click", klik, true);

    return () => {
      window.fetch = asli;
      document.removeEventListener("click", klik, true);
      clearTimeout(st.jeda);
      clearTimeout(st.tutup);
      if (st.nav) {
        clearTimeout(st.nav.pengaman);
        clearInterval(st.nav.cek);
        st.nav = null;
      }
    };
  }, []);

  // Halaman tujuan sudah dipasang (pathname berubah). Dengan loading.jsx, ini
  // terjadi begitu kerangka tampil, jadi tunggu sampai kerangka hilang.
  useEffect(() => {
    const st = s.current;
    if (!st.nav || pathname === st.nav.asal) return undefined;
    if (st.nav.cek) return undefined;
    let kosong = 0;
    const periksa = () => {
      // Dua kali berturut-turut tanpa .skel, supaya jeda antar kerangka tidak terhitung selesai.
      kosong = document.querySelector(".skel") ? 0 : kosong + 1;
      if (kosong >= 2) st.akhiriNav();
    };
    st.nav.cek = setInterval(periksa, CEK_SKELETON_MS);
    return () => {
      /* dibersihkan oleh akhiriNav / efek utama */
    };
  }, [pathname]);

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
