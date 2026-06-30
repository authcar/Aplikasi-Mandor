"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";

const BADGE = {
  OPEN: { label: "BARU", cls: "bg-red-100 text-red-700" },
  IN_PROGRESS: { label: "DIPROSES", cls: "bg-yellow-100 text-yellow-700" },
  DONE: { label: "SELESAI", cls: "bg-green-100 text-green-700" },
};

export default function MasalahList({ items }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [list, setList] = useState(items);

  const ubah = async (id, status) => {
    setBusy(id);
    const res = await fetch("/api/masalah", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(null);
    if (res.ok) {
      setList((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
      router.refresh();
    } else {
      alert("Gagal memperbarui. Coba lagi.");
    }
  };

  if (list.length === 0)
    return (
      <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
        <Icon name="check-circle" className="h-9 w-9" />
        <p className="font-semibold">Belum ada laporan masalah.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {list.map((it) => {
        const b = BADGE[it.status] || BADGE.OPEN;
        return (
          <div key={it.id} className="card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <span className={`badge ${b.cls}`}>{b.label}</span>
                <p className="mt-1.5 font-semibold">{it.judul}</p>
                <p className="text-sm text-gray-500">
                  {it.proyek} · {it.mandor}
                </p>
              </div>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>

            {it.deskripsi && (
              <p className="mb-3 text-sm text-gray-700">{it.deskripsi}</p>
            )}

            {it.foto && (
              <a href={it.foto} target="_blank" className="mb-3 block">
                <img
                  src={it.foto}
                  alt="Foto masalah"
                  className="max-h-56 w-full rounded-xl border border-gray-200 object-cover"
                />
              </a>
            )}

            <div className="grid grid-cols-2 gap-3">
              {it.status === "OPEN" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => ubah(it.id, "IN_PROGRESS")}
                  className="btn col-span-2 border-2 border-amber-500 bg-white text-amber-700 active:bg-amber-50"
                >
                  Tandai Diproses
                </button>
              )}
              {it.status === "IN_PROGRESS" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => ubah(it.id, "DONE")}
                  className="btn-success col-span-2"
                >
                  Tandai Selesai
                </button>
              )}
              {it.status === "DONE" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => ubah(it.id, "OPEN")}
                  className="btn-outline col-span-2 text-gray-500"
                >
                  Buka Lagi
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
