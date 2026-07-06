"use client";
import { useState, useRef, useEffect, useCallback } from "react";

// Modal kamera in-app (getUserMedia) — bekerja di desktop maupun HP.
// onCapture menerima File JPEG hasil jepretan.
export default function KameraModal({ onCapture, onClose, title = "Ambil Foto" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setSiap(true);
        }
      })
      .catch(() => setError("Kamera tidak bisa diakses. Pastikan izin kamera sudah diberikan."));

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const ambilFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(file);
    }, "image/jpeg", 0.9);
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
        <div className="flex shrink-0 justify-center pb-10 pt-6">
          <button
            onClick={ambilFoto}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40"
          />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
