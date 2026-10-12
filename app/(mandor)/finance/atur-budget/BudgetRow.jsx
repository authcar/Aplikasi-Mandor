"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import Icon from "@/components/Icon";

// Baris budget per proyek — tampilan default cuma nama + dua angka ringkas,
// tap "Ubah" buat expand ke dua input sekaligus. Simpan mengirim PATCH ke
// /api/proyek per field yang berubah (endpoint cuma terima satu field per
// request, lihat app/api/proyek/route.js).
export default function BudgetRow({ proyek }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [nilaiProyek, setNilaiProyek] = useState(proyek.nilai_proyek ?? "");
  const [sisaBudget, setSisaBudget] = useState(proyek.sisa_budget ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const batal = () => {
    setNilaiProyek(proyek.nilai_proyek ?? "");
    setSisaBudget(proyek.sisa_budget ?? "");
    setErr("");
    setEdit(false);
  };

  const patch = async (field, value) => {
    const res = await fetch("/api/proyek", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proyek.id, field, value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
  };

  const simpan = async () => {
    setBusy(true);
    setErr("");
    try {
      if (Number(nilaiProyek) !== Number(proyek.nilai_proyek ?? 0)) {
        await patch("nilai_proyek", nilaiProyek);
      }
      if (Number(sisaBudget) !== Number(proyek.sisa_budget ?? 0)) {
        await patch("sisa_budget", sisaBudget);
      }
      setEdit(false);
      router.refresh();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800">{proyek.nama}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <p className="text-xs text-gray-400">
              Jasa <span className="font-semibold text-gray-600">{rupiah(proyek.nilai_proyek)}</span>
            </p>
            <p className="text-xs text-gray-400">
              Sisa <span className="font-semibold text-gray-600">{rupiah(proyek.sisa_budget)}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEdit((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 active:bg-gray-50"
        >
          <Icon name="pencil" className="h-3 w-3" />
          Ubah
        </button>
      </div>

      {edit && (
        <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Nilai Jasa Tukang</label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={nilaiProyek}
              onChange={(e) => setNilaiProyek(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Sisa Budget</label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={sisaBudget}
              onChange={(e) => setSisaBudget(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>
          {err && <p className="text-xs font-medium text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={simpan}
              disabled={busy}
              className="btn-primary flex-1 py-2 text-sm disabled:opacity-60"
            >
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={batal}
              disabled={busy}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 active:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
