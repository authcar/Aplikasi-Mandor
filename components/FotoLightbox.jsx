"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { perbaikiDurasiVideo } from "@/lib/video";

// Thumbnail yang membuka foto (atau video, lewat prop `type="video"`) sebagai
// pop-up fullscreen (tanpa pindah window). Overlay dirender lewat portal ke
// <body> supaya selalu di atas navbar/header.
// Pakai: <FotoLightbox src={url} caption="Nama Proyek">...thumbnail...</FotoLightbox>
export default function FotoLightbox({ src, caption, type = "foto", className = "", children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block text-left ${className}`}
        title={caption || "Lihat foto"}
      >
        {children}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/95"
            onClick={() => setOpen(false)}
          >
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
              <span className="truncate text-sm font-semibold text-white">
                {caption || "Foto"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-1 text-white active:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              {type === "video" ? (
                <video
                  src={src}
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={perbaikiDurasiVideo}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <img
                  src={src}
                  alt={caption || "foto"}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
