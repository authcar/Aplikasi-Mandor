"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { perbaikiDurasiVideo } from "@/lib/video";
import Icon from "@/components/Icon";

// Thumbnail yang membuka foto (atau video, lewat prop `type="video"`) sebagai
// pop-up fullscreen (tanpa pindah window). Overlay dirender lewat portal ke
// <body> supaya selalu di atas navbar/header.
// Pakai: <FotoLightbox src={url} caption="Nama Proyek">...thumbnail...</FotoLightbox>
//
// `driveUrl` (opsional) diisi kalau filenya sudah dipindah ke Google Drive
// (lihat lib/perbaikanMedia.js). Video Drive TIDAK dicoba di-stream lewat
// <video src> -- Drive tidak menyediakan URL video mentah yang bisa
// di-hotlink tanpa OAuth -- jadi videonya dibuka di tab baru lewat viewer
// Drive sendiri. Foto tetap tampil langsung (thumbnail Drive cukup buat
// dilihat), dengan tautan tambahan buat lihat ukuran asli.
export default function FotoLightbox({ src, driveUrl, caption, type = "foto", className = "", children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const videoLewatDrive = type === "video" && !!driveUrl;

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
              {videoLewatDrive ? (
                <>
                  {src && (
                    <img
                      src={src}
                      alt={caption || "video"}
                      className="absolute inset-0 h-full w-full object-contain opacity-40"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-gray-800 shadow-lg active:bg-gray-100"
                    >
                      <Icon name="play" className="h-4 w-4" />
                      Buka Video di Google Drive
                    </a>
                  </div>
                </>
              ) : type === "video" ? (
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

              {!videoLewatDrive && driveUrl && (
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-800 shadow active:bg-white"
                >
                  Lihat ukuran asli di Google Drive
                </a>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
