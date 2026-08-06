"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";

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
            <div className="flex items-start gap-3">
              <MediaGallery media={it.mediaTemuan || []} caption={it.uraian} size="h-14 w-14" rounded="rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-gray-400">No. {it.no}</p>
                  {!it.dibaca_tukang_harian && (
                    <span className="badge shrink-0 bg-red-100 text-red-600">Baru</span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug">{it.uraian}</p>
                <p className="text-[11px] text-gray-400">{tglID(it.created_at)}</p>
              </div>
            </div>
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
