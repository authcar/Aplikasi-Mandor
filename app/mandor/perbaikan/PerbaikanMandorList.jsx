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
    <div className="space-y-3">
      {list.map((it) => {
        const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
        return (
          <div key={it.id} className="card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-400">No. {it.no}</p>
                {!it.dibaca_mandor && (
                  <span className="badge bg-red-100 text-red-600">Baru</span>
                )}
              </div>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>
            <p className="font-semibold">{it.uraian}</p>
            {it.periode && <p className="mt-0.5 text-sm text-gray-500">Periode {it.periode}</p>}
            {it.foto && (
              <FotoLightbox src={it.foto} caption={it.uraian} className="mt-2">
                <img src={it.foto} alt="dokumentasi" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
              </FotoLightbox>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
              {it.status !== "DONE" && (
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
