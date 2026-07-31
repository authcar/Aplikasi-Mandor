"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Tidak Disetujui", cls: "text-red-500" },
};

export default function PerbaikanMandorList({ items = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState(items);
  const [busy, setBusy] = useState(null);

  const tandaiSelesai = async (id) => {
    setBusy(id);
    setList((l) => l.map((x) => (x.id === id ? { ...x, status: "DONE" } : x)));
    await supabase
      .from("checklist_perbaikan")
      .update({ status: "DONE", selesai_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    router.refresh();
  };

  if (list.length === 0)
    return (
      <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
        <Icon name="check-circle" className="h-9 w-9" />
        <p className="font-semibold">Belum ada checklist perbaikan.</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {list.map((it) => {
        const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
        return (
          <div key={it.id} className="card p-3">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-400">No. {it.no}</p>
                {!it.dibaca_tukang_harian && (
                  <span className="badge bg-red-100 text-red-600">Baru</span>
                )}
              </div>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>
            <p className="text-sm font-semibold leading-snug">{it.uraian}</p>
            {it.foto && (
              <FotoLightbox src={it.foto} caption={it.uraian} className="mt-1.5 inline-block">
                <img src={it.foto} alt="dokumentasi" className="h-20 w-28 rounded-lg border border-gray-200 object-cover" />
              </FotoLightbox>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
              {it.status !== "DONE" && it.status !== "CANCELLED" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => tandaiSelesai(it.id)}
                  className="btn-success"
                >
                  Tandai Selesai
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
