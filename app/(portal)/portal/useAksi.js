"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Tombol baru dikunci (`sibuk`) kalau aksi / pemuatan data belum selesai
// setelah jeda ini. Kolom isian menyimpan saat ditinggalkan (blur): kalau
// tombol langsung terkunci saat itu, ketukan pertama pada tombol lain hilang
// (klik tidak sampai ke tombol yang sudah disabled) dan harus diketuk dua kali.
const JEDA_SIBUK_MS = 250;

// Jalankan satu server action (lihat aksi.js), tampilkan pesan, lalu muat ulang data server.
// `sibuk` = aksi berjalan ATAU data baru masih dimuat (dipakai pop up loading di Pesan.jsx).
export function useAksi() {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [memuat, mulai] = useTransition();
  const [muatLama, setMuatLama] = useState(false);
  const [msg, setMsg] = useState("");
  const timer = useRef();
  const tunda = useRef();
  const terlihat = useRef(false); // pop up "Menyimpan…" sudah tampil
  const berjalan = useRef(0); // aksi yang belum selesai (simpan-saat-blur dan klik bisa tumpang tindih)
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(tunda.current); }, []);
  useEffect(() => {
    if (!memuat) { terlihat.current = false; return setMuatLama(false); }
    const t = setTimeout(() => setMuatLama(true), JEDA_SIBUK_MS);
    return () => clearTimeout(t);
  }, [memuat]);

  const jalankan = async (fn, ok) => {
    clearTimeout(timer.current);
    if (berjalan.current++ === 0) {
      clearTimeout(tunda.current);
      tunda.current = setTimeout(() => { terlihat.current = true; setSibuk(true); }, JEDA_SIBUK_MS);
    }
    setMsg("");
    let error;
    try {
      ({ error } = (await fn()) || {});
    } catch {
      // Mis. sinyal hilang di lokasi/workshop.
      error = "tidak tersambung ke server. Periksa koneksi lalu coba lagi.";
    }
    if (--berjalan.current === 0) {
      clearTimeout(tunda.current);
      setSibuk(false);
    }
    if (error) {
      setMsg(`Gagal: ${error}`);
      return false;
    }
    if (ok) {
      setMsg(ok);
      // Pesan berhasil hilang sendiri; pesan gagal tetap sampai diketuk.
      timer.current = setTimeout(() => setMsg(""), 3500);
    }
    // Kalau pop up sudah tampil, biarkan tetap tampil selama data dimuat ulang (tidak berkedip dua kali).
    if (terlihat.current) setMuatLama(true);
    mulai(() => router.refresh());
    return true;
  };

  return { jalankan, sibuk: sibuk || muatLama, msg, setMsg };
}
