import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";

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
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-gray-400">{it.proyek}</p>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>
            <p className="text-sm font-semibold leading-snug">{it.uraian}</p>
            <p className="mt-0.5 text-xs text-gray-500">Dibuat oleh {it.pembuat}</p>
            {(it.foto || it.fotoBukti) && (
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {it.foto && (
                  <FotoLightbox src={it.foto} caption={it.uraian}>
                    <img src={it.foto} alt="dokumentasi temuan" className="h-16 w-full rounded-lg border border-gray-200 object-cover" />
                    <p className="mt-0.5 text-[10px] text-gray-400">Temuan</p>
                  </FotoLightbox>
                )}
                {it.fotoBukti && (
                  <FotoLightbox src={it.fotoBukti} caption={`Bukti — ${it.uraian}`}>
                    <img src={it.fotoBukti} alt="bukti pengerjaan" className="h-16 w-full rounded-lg border border-gray-200 object-cover" />
                    <p className="mt-0.5 text-[10px] text-gray-400">Bukti Mandor</p>
                  </FotoLightbox>
                )}
              </div>
            )}
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
