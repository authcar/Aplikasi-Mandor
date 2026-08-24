"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { SISI_MAKS, KUALITAS } from "@/lib/gambar";

// Modal kamera in-app (getUserMedia) — bekerja di desktop maupun HP.
// onCapture menerima File JPEG hasil jepretan. Default kamera belakang
// ("environment"), bisa ditukar ke kamera depan lewat tombol switch.
export default function KameraModal({ onCapture, onClose, title = "Ambil Foto" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  useEffect(() => {
    let batal = false;
    setSiap(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
      .then((stream) => {
        if (batal) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setSiap(true);
        }
      })
      .catch(() => setError("Kamera tidak bisa diakses. Pastikan izin kamera sudah diberikan."));

    return () => {
      batal = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const tukarKamera = () => setFacingMode((m) => (m === "environment" ? "user" : "environment"));

  const ambilFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    // Ukuran & kualitas mengikuti aturan yang sama dengan foto dari galeri
    // (lib/gambar.js), supaya satu laporan tidak berisi campuran foto 200 KB
    // dan 4 MB cuma karena beda cara mengambilnya.
    const skala = Math.min(1, SISI_MAKS / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * skala));
    canvas.height = Math.max(1, Math.round(video.videoHeight * skala));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(file);
    }, "image/jpeg", KUALITAS);
  }, [onCapture]);

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
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
        )}
      </div>
      {siap && (
        <div className="relative flex shrink-0 items-center justify-center pb-10 pt-6">
          <button
            onClick={ambilFoto}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40"
          />
          <button
            type="button"
            onClick={tukarKamera}
            title="Ganti kamera"
            className="absolute right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
          >
            <Icon name="switch-camera" className="h-5 w-5" />
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
