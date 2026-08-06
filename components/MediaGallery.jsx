import FotoLightbox from "@/components/FotoLightbox";
import Icon from "@/components/Icon";

// Galeri thumbnail scroll-horizontal, pengganti pola "avatar stack" lama
// (maks 4 slot tetap) -- sekarang bisa N item (maks 5/jenis, lihat cap di
// supabase/add_checklist_perbaikan_multi_media.sql). Dipakai di
// PerbaikanForm, PerbaikanMandorList, dan PerbaikanList (master & finance).
export default function MediaGallery({ media = [], caption, size = "h-9 w-9", rounded = "rounded-md" }) {
  if (!media.length) return null;
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto">
      {media.map((m, i) => (
        <FotoLightbox key={m.id || m.url || i} src={m.url} caption={m.caption || caption} type={m.tipe}>
          {m.tipe === "video" ? (
            <span className={`flex ${size} items-center justify-center ${rounded} border-2 border-white bg-gray-800 text-white ring-1 ring-gray-200`}>
              <Icon name="play" className="h-3.5 w-3.5" />
            </span>
          ) : (
            <img
              src={m.url}
              alt={m.caption || caption || "dokumentasi"}
              className={`${size} ${rounded} border-2 border-white object-cover ring-1 ring-gray-200`}
            />
          )}
        </FotoLightbox>
      ))}
    </div>
  );
}
