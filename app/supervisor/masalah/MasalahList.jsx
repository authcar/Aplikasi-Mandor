"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { tglID } from "@/lib/format";

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
      <div className="rounded-xl bg-green-100 p-6 text-center text-green-800">
        🎉 Belum ada laporan masalah.
      </div>
    );

  return (
    <div className="space-y-3">
      {list.map((it) => {
        const b = BADGE[it.status] || BADGE.OPEN;
        return (
          <div key={it.id} className="rounded-2xl border-2 border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.cls}`}>
                  {b.label}
                </span>
                <p className="mt-1 font-semibold">{it.judul}</p>
                <p className="text-sm text-gray-500">
                  {it.proyek} · {it.mandor}
                </p>
              </div>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>

            {it.deskripsi && (
              <p className="mb-2 text-sm text-gray-700">{it.deskripsi}</p>
            )}

            {it.foto && (
              <a href={it.foto} target="_blank" className="mb-3 block">
                <img
                  src={it.foto}
                  alt="Foto masalah"
                  className="max-h-56 w-full rounded-xl border object-cover"
                />
              </a>
            )}

            <div className="grid grid-cols-2 gap-3">
              {it.status === "OPEN" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => ubah(it.id, "IN_PROGRESS")}
                  className="col-span-2 rounded-xl border-2 border-yellow-500 p-3 font-bold text-yellow-700 disabled:opacity-50"
                >
                  Tandai Diproses
                </button>
              )}
              {it.status === "IN_PROGRESS" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => ubah(it.id, "DONE")}
                  className="col-span-2 rounded-xl bg-green-600 p-3 font-bold text-white disabled:opacity-50"
                >
                  Tandai Selesai
                </button>
              )}
              {it.status === "DONE" && (
                <button
                  disabled={busy === it.id}
                  onClick={() => ubah(it.id, "OPEN")}
                  className="col-span-2 rounded-xl border-2 border-gray-300 p-3 font-bold text-gray-500 disabled:opacity-50"
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
