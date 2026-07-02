"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";

const URGENSI_BADGE = {
  Mendesak: "bg-red-100 text-red-700",
  Sedang: "bg-amber-100 text-amber-700",
  Rendah: "bg-blue-100 text-blue-700",
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
        <p className="font-semibold">Belum ada laporan kurang material.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {list.map((it) => (
        <div key={it.id} className="card p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${URGENSI_BADGE[it.urgensi] || "bg-gray-100 text-gray-600"}`}>
                {it.urgensi || "Sedang"}
              </span>
              {it.status === "DONE" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-500">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Sudah Datang
                </span>
              )}
              {it.status === "IN_PROGRESS" && (
                <span className="text-xs font-semibold text-amber-500">Diproses</span>
              )}
            </div>
            <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
          </div>

          <p className="font-semibold">{it.material || it.judul}</p>
          <p className="text-sm text-gray-500 mb-1">
            {it.jumlah} {it.satuan} · {it.proyek} · {it.mandor}
          </p>

          {it.catatan && (
            <p className="mb-3 text-sm text-gray-600">{it.catatan}</p>
          )}

          <div className="mt-3">
            {it.status === "OPEN" && (
              <button
                disabled={busy === it.id}
                onClick={() => ubah(it.id, "IN_PROGRESS")}
                className="btn w-full border-2 border-amber-500 bg-white text-amber-700 active:bg-amber-50"
              >
                Tandai Diproses
              </button>
            )}
            {it.status === "IN_PROGRESS" && (
              <button
                disabled={busy === it.id}
                onClick={() => ubah(it.id, "DONE")}
                className="btn-success w-full"
              >
                Tandai Sudah Datang
              </button>
            )}
            {it.status === "DONE" && (
              <button
                disabled={busy === it.id}
                onClick={() => ubah(it.id, "OPEN")}
                className="btn-outline w-full text-gray-500"
              >
                Buka Lagi
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
