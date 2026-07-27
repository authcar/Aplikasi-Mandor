"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

// Master menginput/mengubah Nilai Jasa Tukang per proyek secara manual.
// Field ini tidak lagi disinkron dari Taraco — lihat lib/supabase/syncProyek.js.
export default function NilaiJasaForm({ proyekId, nilaiAwal }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [nilai, setNilai] = useState(nilaiAwal ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const batal = () => {
    setNilai(nilaiAwal ?? "");
    setErr("");
    setEdit(false);
  };

  const simpan = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/proyek", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proyekId, nilai_proyek: nilai }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
      setEdit(false);
      router.refresh();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  if (!edit) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="label">Nilai Jasa Tukang</p>
          <p className="text-lg font-semibold">
            {nilaiAwal ? rupiah(nilaiAwal) : "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdit(true)}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 active:bg-gray-50"
        >
          Ubah
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="label">Nilai Jasa Tukang</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={nilai}
          onChange={(e) => setNilai(e.target.value)}
          placeholder="0"
          className="input"
          autoFocus
        />
        <button
          type="button"
          onClick={simpan}
          disabled={busy}
          className="btn-primary shrink-0 px-4 py-2 text-sm"
        >
          {busy ? "..." : "Simpan"}
        </button>
        <button
          type="button"
          onClick={batal}
          disabled={busy}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 active:bg-gray-50"
        >
          Batal
        </button>
      </div>
      {err && <p className="mt-1.5 text-sm font-medium text-red-600">{err}</p>}
    </div>
  );
}
