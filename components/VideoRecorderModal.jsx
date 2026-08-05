"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { perbaikiDurasiVideo } from "@/lib/video";

// Modal rekam video in-app (getUserMedia + MediaRecorder) — sejalan dengan
// KameraModal (foto): tekan buat mulai rekam, tekan lagi buat stop, lalu
// preview hasilnya dan bisa "Ulangi" sebelum dipakai (onCapture). Default
// kamera belakang ("environment"), bisa ditukar ke kamera depan sebelum
// mulai rekam.
export default function VideoRecorderModal({ onCapture, onClose, title = "Rekam Video", maxDetik = 60 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState(null);
  const [merekam, setMerekam] = useState(false);
  const [detik, setDetik] = useState(0);
  const [hasilUrl, setHasilUrl] = useState(null);
  const [hasilFile, setHasilFile] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  // Lepas stream lama dulu (kalau ada) sebelum minta yang baru — dipakai
  // baik saat buka pertama kali, ganti kamera, maupun "Ulangi".
  const bukaKamera = useCallback((mode) => {
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: mode }, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setSiap(true);
        }
      })
      .catch(() => setError("Kamera/mikrofon tidak bisa diakses. Pastikan izin sudah diberikan."));
  }, []);

  useEffect(() => {
    bukaKamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
  }, [facingMode, bukaKamera]);

  const tukarKamera = () => setFacingMode((m) => (m === "environment" ? "user" : "environment"));

  // Kamera/mic dilepas di rec.onstop (bukan di sini) — recorder.stop() itu
  // asinkron, butuh waktu buat "flush" data terakhir. Mematikan track kamera
  // duluan sebelum flush selesai bikin sebagian HP Android menghasilkan file
  // video kosong/corrupt (preview jadi blank total setelah "berhasil" rekam).
  const stopRekam = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setMerekam(false);
  }, []);

  const mulaiRekam = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
    const rec = new MediaRecorder(streamRef.current, { mimeType });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `video-${Date.now()}.${ext}`, { type: mimeType });
      setHasilFile(file);
      setHasilUrl(URL.createObjectURL(file));
      // Kamera/mic dilepas di sini (bukan pas tombol stop ditekan) — lihat
      // catatan di stopRekam.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    rec.start();
    recorderRef.current = rec;
    setMerekam(true);
    setDetik(0);
    timerRef.current = setInterval(() => {
      setDetik((d) => {
        const next = d + 1;
        if (next >= maxDetik) stopRekam();
        return next;
      });
    }, 1000);
  }, [maxDetik, stopRekam]);

  const ulangi = () => {
    setHasilFile(null);
    setHasilUrl(null);
    bukaKamera(facingMode);
  };

  const pakai = () => {
    if (hasilFile) onCapture(hasilFile);
  };

  const mm = String(Math.floor(detik / 60)).padStart(2, "0");
  const ss = String(detik % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="text-white">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">{title}</span>
        <div className="w-6" />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-red-400">{error}</p>
        ) : hasilUrl ? (
          <video
            src={hasilUrl}
            controls
            autoPlay
            playsInline
            onLoadedMetadata={perbaikiDurasiVideo}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
        )}
        {merekam && (
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {mm}:{ss}
          </span>
        )}
        {hasilUrl && (
          <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Rekaman selesai — {mm}:{ss}
          </span>
        )}
      </div>

      {siap && !error && (
        <div className="flex shrink-0 flex-col items-center gap-2 pb-10 pt-6">
          {hasilUrl ? (
            <div className="flex items-center gap-4">
              <button
                onClick={ulangi}
                className="rounded-xl border-2 border-white/40 px-5 py-3 text-sm font-semibold text-white active:bg-white/10"
              >
                Ulangi
              </button>
              <button
                onClick={pakai}
                className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white active:bg-brand-800"
              >
                Pakai Video
              </button>
            </div>
          ) : (
            <>
              <div className="relative flex w-full items-center justify-center">
                <button
                  onClick={merekam ? stopRekam : mulaiRekam}
                  className={`h-16 w-16 rounded-full border-4 border-white ${merekam ? "bg-red-500" : "bg-white/20 active:bg-white/40"}`}
                />
                {!merekam && (
                  <button
                    type="button"
                    onClick={tukarKamera}
                    title="Ganti kamera"
                    className="absolute right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
                  >
                    <Icon name="switch-camera" className="h-5 w-5" />
                  </button>
                )}
              </div>
              {!merekam && <p className="text-xs text-white/60">Maks {maxDetik} detik</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
