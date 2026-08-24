"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

// Ubah base64url (format VAPID public key) jadi Uint8Array, format yang
// diminta pushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const iniIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const iniStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// Dipasang sekali di tiap layout role (Mandor/Supervisor/Master/Finance/
// Tukang Harian). Mendaftarkan service worker + subscribe ke web push, lalu
// menyimpan subscription-nya lewat /api/push/subscribe.
//
// KENAPA IZINNYA LEWAT TOMBOL, BUKAN OTOMATIS SAAT HALAMAN DIMUAT:
// iOS/iPadOS mensyaratkan Notification.requestPermission() dipanggil dari
// sentuhan user langsung. Dipanggil dari useEffect, promise-nya ditolak
// NotAllowedError dan prompt izinnya tidak pernah muncul — di Android hal yang
// sama berjalan mulus, jadi kegagalannya cuma kelihatan di iPhone. Karena itu
// permintaan izin di sini SELALU berangkat dari onClick tombol di bawah.
//
// Aturan tambahan iOS: push hanya jalan kalau app dibuka dari ikon Home Screen
// (standalone), dan butuh iOS 16.4+. Dua-duanya dideteksi di sini dan
// dijelaskan ke user, bukan didiamkan.
export default function PushNotificationSetup() {
  // "diam"          -> tidak menampilkan apa pun (sudah aktif / browser tanpa push)
  // "perlu-install" -> iOS tapi masih dibuka dari tab Safari
  // "perlu-ios"     -> iOS standalone tapi versinya di bawah 16.4
  // "perlu-izin"    -> tinggal menekan tombol Aktifkan
  // "ditolak"       -> izin pernah ditolak, harus lewat Pengaturan
  const [status, setStatus] = useState("diam");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState(null);
  const hidup = useRef(true);

  // Daftarkan device ini ke web push. `minta: true` hanya dipakai dari tombol
  // (lihat catatan user gesture di atas); pemanggilan otomatis saat halaman
  // dimuat memakai `minta: false` dan berhenti kalau izinnya belum ada.
  const daftarkan = useCallback(async ({ minta }) => {
    // register() selesai begitu file-nya diterima, BELUM tentu service
    // worker-nya sudah aktif — dan pushManager.subscribe() pada registration
    // yang belum aktif gagal dengan "Subscription failed - no active Service
    // Worker". Itu persis yang terjadi di kunjungan pertama seseorang, yaitu
    // saat tombol ini paling mungkin ditekan. `ready` menunggu sampai ada
    // worker aktif, jadi ambil registration-nya dari sana.
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;

    if (minta && Notification.permission === "default") {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        if (hidup.current) setStatus(izin === "denied" ? "ditolak" : "perlu-izin");
        return;
      }
    }
    if (Notification.permission !== "granted") {
      if (hidup.current)
        setStatus(Notification.permission === "denied" ? "ditolak" : "perlu-izin");
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
    }

    // Sesi dicek SETELAH subscribe supaya izin yang sudah diberikan tidak
    // terbuang, tapi tetap wajib ada: /api/push/subscribe menulis lewat RLS
    // (profile_id = auth.uid()), jadi tanpa sesi barisnya tidak akan tersimpan.
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Sesi login tidak terbaca. Muat ulang halaman, lalu coba lagi.");

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!res.ok) throw new Error("Server menolak pendaftaran notifikasi. Coba lagi nanti.");

    if (hidup.current) {
      setGalat(null);
      setStatus("diam");
    }
  }, []);

  useEffect(() => {
    hidup.current = true;

    const dukung =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (!dukung) {
      // Di iPhone yang sudah standalone, tidak adanya PushManager artinya
      // iOS-nya di bawah 16.4 — itu bisa diperbaiki user, jadi dikasih tahu.
      // Di browser lain (mis. Safari desktop lama) diam saja.
      if (iniIos() && iniStandalone()) setStatus("perlu-ios");
      return () => {
        hidup.current = false;
      };
    }

    if (iniIos() && !iniStandalone()) {
      setStatus("perlu-install");
      return () => {
        hidup.current = false;
      };
    }

    if (Notification.permission === "denied") setStatus("ditolak");
    else if (Notification.permission === "default") setStatus("perlu-izin");
    else {
      // Izin sudah ada: perbarui pendaftaran diam-diam. Subscription bisa
      // dicabut/diganti push service kapan saja, jadi ini dijalankan tiap
      // halaman dibuka, bukan sekali seumur akun.
      daftarkan({ minta: false }).catch((e) => {
        // Kalau jalur diam-diam ini gagal, jangan ikut diam — tampilkan
        // tombolnya supaya user punya cara mencoba ulang dan melihat sebabnya.
        if (!hidup.current) return;
        setGalat(e?.message || "Pendaftaran notifikasi gagal.");
        setStatus("perlu-izin");
      });
    }

    return () => {
      hidup.current = false;
    };
  }, [daftarkan]);

  const aktifkan = async () => {
    setSibuk(true);
    setGalat(null);
    try {
      await daftarkan({ minta: true });
    } catch (e) {
      if (hidup.current) setGalat(e?.message || "Pendaftaran notifikasi gagal.");
    } finally {
      if (hidup.current) setSibuk(false);
    }
  };

  if (status === "diam") return null;

  const Bingkai = ({ warna, children }) => (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md px-3">
      <div className={`card flex items-start gap-3 p-3 text-xs ${warna}`}>{children}</div>
    </div>
  );

  if (status === "perlu-install")
    return (
      <Bingkai warna="border-blue-200 bg-blue-50 text-blue-900">
        <Icon name="share" className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="leading-relaxed">
          <b>Notifikasi belum aktif.</b> iPhone hanya mengizinkan notifikasi dari app yang sudah
          ditambahkan ke layar Home. Buka menu <b>Share</b> di Safari → <b>Add to Home Screen</b>,
          lalu buka aplikasi dari ikon Taraco dan login lagi di sana.
        </p>
      </Bingkai>
    );

  if (status === "perlu-ios")
    return (
      <Bingkai warna="border-amber-200 bg-amber-50 text-amber-900">
        <Icon name="alert-triangle" className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="leading-relaxed">
          <b>Notifikasi belum didukung.</b> iPhone ini perlu diperbarui ke{" "}
          <b>iOS 16.4 atau lebih baru</b> (Settings → General → Software Update) agar bisa menerima
          notifikasi.
        </p>
      </Bingkai>
    );

  if (status === "ditolak")
    return (
      <Bingkai warna="border-amber-200 bg-amber-50 text-amber-900">
        <Icon name="bell" className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="leading-relaxed">
          <b>Notifikasi ditolak di HP ini.</b>{" "}
          {iniIos()
            ? "Aktifkan lewat Settings → Notifications → Taraco. Kalau Taraco tidak ada di daftar, hapus ikonnya dari layar Home lalu tambahkan ulang."
            : "Aktifkan lewat ikon gembok di sebelah alamat situs → Notifications → Allow."}
        </p>
      </Bingkai>
    );

  return (
    <Bingkai warna="border-blue-200 bg-blue-50 text-blue-900">
      <Icon name="bell" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed">
          <b>Notifikasi belum aktif.</b> Tanpa ini Anda tidak akan menerima pengingat dan konfirmasi
          lokasi saat kunjungan.
        </p>
        {galat && <p className="mt-1 font-semibold text-red-600">{galat}</p>}
      </div>
      <button
        type="button"
        onClick={aktifkan}
        disabled={sibuk}
        className="btn shrink-0 bg-brand px-3 py-2 text-xs text-white disabled:opacity-60"
      >
        {sibuk ? "Memproses…" : "Aktifkan"}
      </button>
    </Bingkai>
  );
}
