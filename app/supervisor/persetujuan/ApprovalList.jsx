"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import Icon from "@/components/Icon";

const NOMINAL_CLS = {
  lembur: "text-indigo-600",
  KASBON: "text-amber-600",
  REIMBURSE: "text-purple-600",
};

// Daftar pengajuan PENDING + tombol Setujui/Tolak.
export default function ApprovalList({ items }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [list, setList] = useState(items);
  const [nota, setNota] = useState(null); // {url, judul}
  const [unduh, setUnduh] = useState(false);

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

  const unduhNota = async () => {
    if (!nota?.url) return;
    setUnduh(true);
    try {
      const r = await fetch(nota.url);
      const blob = await r.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `nota-${(nota.judul || "bukti").replace(/\s+/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    } catch {
      alert("Gagal mengunduh nota.");
    } finally {
      setUnduh(false);
    }
  };

  const isPdf = nota?.url && /\.pdf(\?|$)/i.test(nota.url);

  return (
    <>
      {list.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
          <Icon name="check-circle" className="h-9 w-9" />
          <p className="font-semibold">Tidak ada pengajuan menunggu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((it) => (
            <div key={it.id} className="card p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <span
                    className={`badge ${
                      it._tipe === "lembur"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {it._label}
                  </span>
                  <p className="mt-1.5 font-semibold">{it._judul}</p>
                  <p className="text-sm text-gray-500">
                    {it._proyek} · {it._mandor}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-lg font-bold ${
                    NOMINAL_CLS[it._tipe === "lembur" ? "lembur" : it._label] || ""
                  }`}
                >
                  {rupiah(it._nominal)}
                </p>
              </div>

              {it._nota && (
                <button
                  onClick={() => setNota({ url: it._nota, judul: it._judul })}
                  className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
                >
                  <Icon name="receipt" className="h-4 w-4" />
                  Lihat nota
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={busy === it.id}
                  onClick={() => review(it._tipe, it.id, "REJECTED")}
                  className="btn-danger"
                >
                  Tolak
                </button>
                <button
                  disabled={busy === it.id}
                  onClick={() => review(it._tipe, it.id, "APPROVED")}
                  className="btn-success"
                >
                  Setujui
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pop-up nota (tanpa buka tab baru) */}
      {nota && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setNota(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-3 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="truncate font-semibold">{nota.judul || "Nota"}</p>
              <button
                onClick={() => setNota(null)}
                className="px-2 text-2xl leading-none text-gray-400"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-lg bg-gray-50">
              {isPdf ? (
                <iframe src={nota.url} title="Nota" className="h-[60vh] w-full rounded-lg" />
              ) : (
                <img
                  src={nota.url}
                  alt="Nota"
                  className="mx-auto max-h-[60vh] w-full rounded-lg object-contain"
                />
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => setNota(null)} className="btn-outline">
                Tutup
              </button>
              <button onClick={unduhNota} disabled={unduh} className="btn-primary">
                {unduh ? "Mengunduh..." : "Unduh"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
