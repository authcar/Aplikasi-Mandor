import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  PENDING_REVIEW: { label: "Menunggu Persetujuan Supervisor", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Tidak Disetujui", cls: "text-red-500" },
};

// Read-only — Finance hanya memantau, persetujuan tetap di Supervisor
// (lihat app/supervisor/perbaikan/PerbaikanForm.jsx).
export default function PerbaikanList({ items = [] }) {
  if (items.length === 0)
    return (
      <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
        <Icon name="check-circle" className="h-9 w-9" />
        <p className="font-semibold">Belum ada item perbaikan.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
        return (
          <div key={it.id} className="card p-3">
            <div className="flex items-start gap-3">
              <MediaGallery
                media={[
                  ...(it.mediaTemuan || []).map((m) => ({ ...m, caption: it.uraian })),
                  ...(it.mediaBukti || []).map((m) => ({ ...m, caption: `Bukti — ${it.uraian}` })),
                ]}
                size="h-14 w-14"
                rounded="rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-gray-400">{it.proyek}</p>
                  <p className="shrink-0 text-[11px] text-gray-400">{tglID(it.created_at)}</p>
                </div>
                <p className="text-sm font-semibold leading-snug">{it.uraian}</p>
                <p className="text-[11px] text-gray-400">Dibuat oleh {it.pembuat}</p>
              </div>
            </div>
            {it.catatan_tolak && (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2">
                <p className="text-xs font-bold text-red-700">Ditolak Supervisor</p>
                <p className="text-sm text-red-600">{it.catatan_tolak}</p>
              </div>
            )}
            <p className={`mt-2 text-xs font-semibold ${st.cls}`}>{st.label}</p>
          </div>
        );
      })}
    </div>
  );
}
