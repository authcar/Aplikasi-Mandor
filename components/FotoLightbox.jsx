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
//
// `items` + `index` (opsional) diisi kalau thumbnail ini bagian dari galeri
// -- dengan itu overlay dapat tombol panah kiri/kanan buat geser antar
// foto/video tanpa perlu nutup lalu buka thumbnail lain.
export default function FotoLightbox({ src, driveUrl, caption, type = "foto", items, index = 0, className = "", children }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(index);

  const galeri = items && items.length > 1 ? items : null;
  const current = galeri ? galeri[activeIndex] : { src, driveUrl, caption, type };
  const hasPrev = !!galeri && activeIndex > 0;
  const hasNext = !!galeri && activeIndex < galeri.length - 1;

  const goPrev = (e) => {
    e.stopPropagation();
    setActiveIndex((i) => Math.max(0, i - 1));
  };
  const goNext = (e) => {
    e.stopPropagation();
    setActiveIndex((i) => Math.min(galeri.length - 1, i + 1));
  };

  useEffect(() => {
    if (open) setActiveIndex(index);
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft" && hasPrev) setActiveIndex((i) => i - 1);
      else if (e.key === "ArrowRight" && hasNext) setActiveIndex((i) => i + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, hasPrev, hasNext]);

  const videoLewatDrive = current.type === "video" && !!current.driveUrl;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block text-left ${className}`}
        title={caption || current.caption || "Lihat foto"}
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
                {current.caption || "Foto"}
                {galeri && ` (${activeIndex + 1}/${galeri.length})`}
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
                  {current.src && (
                    <img
                      src={current.src}
                      alt={current.caption || "video"}
                      className="absolute inset-0 h-full w-full object-contain opacity-40"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <a
                      href={current.driveUrl}
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
              ) : current.type === "video" ? (
                <video
                  key={current.src}
                  src={current.src}
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={perbaikiDurasiVideo}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <img
                  src={current.src}
                  alt={current.caption || "foto"}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}

              {hasPrev && (
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Sebelumnya"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur active:bg-white/40"
                >
                  <Icon name="chevron-left" className="h-6 w-6" />
                </button>
              )}
              {hasNext && (
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Berikutnya"
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur active:bg-white/40"
                >
                  <Icon name="chevron-right" className="h-6 w-6" />
                </button>
              )}

              {!videoLewatDrive && current.driveUrl && (
                <a
                  href={current.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-800 shadow active:bg-white"
                >
                  Buka di Gdrive
                </a>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
