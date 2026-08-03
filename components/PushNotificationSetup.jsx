"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Ubah base64url (format VAPID public key) jadi Uint8Array, format yang
// diminta pushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Dipasang sekali di tiap layout role (Mandor/Supervisor/Master/Tukang
// Harian). Registrasi service worker + minta izin notifikasi + subscribe ke
// web push, lalu simpan subscription-nya lewat /api/push/subscribe. Tidak
// merender apa-apa selain hint kecil khusus iOS (lihat NOTE di bawah).
export default function PushNotificationSetup() {
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // iOS Safari HANYA mengizinkan push kalau app sudah di-install ke Home
    // Screen (dijalankan standalone) — minta izin dari tab browser biasa
    // akan gagal diam-diam. Kalau terdeteksi iOS + belum standalone,
    // tampilkan hint instalasi saja, jangan minta permission.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (isIos && !isStandalone) {
      setShowIosHint(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");

      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
      }
      if (Notification.permission !== "granted" || cancelled) return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        });
      }
      if (cancelled) return;

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!showIosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md bg-blue-50 px-4 py-2 text-center text-xs text-blue-800">
      Untuk notifikasi update, buka menu Share di Safari lalu pilih &quot;Add to Home
      Screen&quot;.
    </div>
  );
}
