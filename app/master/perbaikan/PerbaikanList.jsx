import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  PENDING_REVIEW: { label: "Menunggu Persetujuan Supervisor", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Dibatalkan", cls: "text-red-500" },
};

// Read-only — Master hanya memantau, persetujuan tetap di Supervisor
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
    <div className="space-y-3">
      {items.map((it) => {
        const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
        return (
          <div key={it.id} className="card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-gray-400">
                No. {it.no} · {it.proyek}
              </p>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>
            <p className="font-semibold">{it.uraian}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {it.periode ? `Periode ${it.periode} · ` : ""}Dibuat oleh {it.pembuat}
            </p>
            {it.foto && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-semibold text-gray-500">Foto Temuan</p>
                <FotoLightbox src={it.foto} caption={it.uraian}>
                  <img src={it.foto} alt="dokumentasi temuan" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
                </FotoLightbox>
              </div>
            )}
            {it.fotoBukti && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-semibold text-gray-500">Foto Bukti Pengerjaan Mandor</p>
                <FotoLightbox src={it.fotoBukti} caption={`Bukti — ${it.uraian}`}>
                  <img src={it.fotoBukti} alt="bukti pengerjaan" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
                </FotoLightbox>
              </div>
            )}
            <p className={`mt-3 text-xs font-semibold ${st.cls}`}>{st.label}</p>
          </div>
        );
      })}
    </div>
  );
}
