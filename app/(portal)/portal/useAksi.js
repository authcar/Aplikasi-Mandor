"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Jalankan satu server action (lihat aksi.js), tampilkan pesan, lalu muat ulang data server.
export function useAksi() {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [msg, setMsg] = useState("");
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const jalankan = async (fn, ok) => {
    clearTimeout(timer.current);
    setSibuk(true);
    setMsg("");
    let error;
    try {
      ({ error } = (await fn()) || {});
    } catch {
      // Mis. sinyal hilang di lokasi/workshop.
      error = "tidak tersambung ke server. Periksa koneksi lalu coba lagi.";
    }
    setSibuk(false);
    if (error) {
      setMsg(`Gagal: ${error}`);
      return false;
    }
    if (ok) {
      setMsg(ok);
      // Pesan berhasil hilang sendiri; pesan gagal tetap sampai diketuk.
      timer.current = setTimeout(() => setMsg(""), 3500);
    }
    router.refresh();
    return true;
  };

  return { jalankan, sibuk, msg, setMsg };
}
