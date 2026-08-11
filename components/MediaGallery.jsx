import FotoLightbox from "@/components/FotoLightbox";
import Icon from "@/components/Icon";

// Galeri thumbnail scroll-horizontal, pengganti pola "avatar stack" lama
// (maks 4 slot tetap) -- sekarang bisa N item (maks 10/jenis, lihat cap di
// supabase/fix_checklist_perbaikan_media_cap.sql). Dipakai di
// PerbaikanForm, PerbaikanMandorList, dan PerbaikanList (master & finance).
//
// `m.url` selalu link gambar (thumbnail Google Drive kalau `m.driveUrl`
// terisi -- lihat lib/perbaikanMedia.js -- atau signed URL Supabase selama
// file masih di Storage). Video pre-sync belum punya thumbnail gambar (baru
// ada raw video src), jadi masih pakai ikon statis; video yang sudah ke
// Drive dapat thumbnail asli + badge play di atasnya.
export default function MediaGallery({ media = [], caption, size = "h-9 w-9", rounded = "rounded-md" }) {
  if (!media.length) return null;
  const items = media.map((m) => ({
    src: m.url,
    driveUrl: m.driveUrl,
    caption: m.caption || caption,
    type: m.tipe,
  }));
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto">
      {media.map((m, i) => (
        <FotoLightbox
          key={m.id || m.url || i}
          items={items}
          index={i}
        >
          {m.tipe === "video" && !m.driveUrl ? (
            <span className={`flex ${size} items-center justify-center ${rounded} border-2 border-white bg-gray-800 text-white ring-1 ring-gray-200`}>
              <Icon name="play" className="h-3.5 w-3.5" />
            </span>
          ) : (
            <span className="relative block">
              <img
                src={m.url}
                alt={m.caption || caption || "dokumentasi"}
                className={`${size} ${rounded} border-2 border-white object-cover ring-1 ring-gray-200`}
              />
              {m.tipe === "video" && (
                <span className={`absolute inset-0 flex items-center justify-center ${rounded} bg-black/25`}>
                  <Icon name="play" className="h-3.5 w-3.5 text-white" />
                </span>
              )}
            </span>
          )}
        </FotoLightbox>
      ))}
    </div>
  );
}
