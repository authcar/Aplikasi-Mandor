"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

// Daftar pengajuan PENDING + tombol Setujui/Tolak.
export default function ApprovalList({ items }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [list, setList] = useState(items);

  const review = async (tipe, id, aksi) => {
    setBusy(id);
    const res = await fetch("/api/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipe, id, aksi }),
    });
    setBusy(null);
    if (res.ok) {
      setList((l) => l.filter((x) => x.id !== id)); // hilangkan dari layar
      router.refresh();
    } else {
      alert("Gagal memproses. Coba lagi.");
    }
  };

  if (list.length === 0)
    return (
      <div className="rounded-xl bg-green-100 p-6 text-center text-green-800">
        🎉 Tidak ada pengajuan menunggu.
      </div>
    );

  return (
    <div className="space-y-3">
      {list.map((it) => (
        <div key={it.id} className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  it._tipe === "lembur"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {it._label}
              </span>
              <p className="mt-1 font-semibold">{it._judul}</p>
              <p className="text-sm text-gray-500">
                {it._proyek} · {it._mandor}
              </p>
            </div>
            <p className="text-lg font-bold">{rupiah(it._nominal)}</p>
          </div>

          {it._nota && (
            <a
              href={it._nota}
              target="_blank"
              className="mb-2 inline-block text-sm text-brand underline"
            >
              Lihat nota
            </a>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy === it.id}
              onClick={() => review(it._tipe, it.id, "REJECTED")}
              className="rounded-xl border-2 border-red-500 p-3 font-bold text-red-600 disabled:opacity-50"
            >
              Tolak
            </button>
            <button
              disabled={busy === it.id}
              onClick={() => review(it._tipe, it.id, "APPROVED")}
              className="rounded-xl bg-green-600 p-3 font-bold text-white disabled:opacity-50"
            >
              Setujui
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
