"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

export default function PosBiayaManager({ initialPos = [] }) {
  const [pos, setPos] = useState(initialPos);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");

    const res = await fetch("/api/pos-biaya", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setErr(json.error || "Gagal menyimpan.");

    setPos((list) => [...list, json].sort((a, b) => a.nama.localeCompare(b.nama)));
    setShowForm(false);
    setNama("");
  };

  const toggleAktif = async (p) => {
    setBusyId(p.id);
    const res = await fetch("/api/pos-biaya", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) return alert(json.error || "Gagal menyimpan.");
    setPos((list) => list.map((x) => (x.id === p.id ? json : x)));
  };

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary btn-lg mb-4 w-full flex items-center justify-center gap-2"
        >
          <Icon name="plus" className="h-5 w-5" />
          Tambah Pos Biaya
        </button>
      ) : (
        <form onSubmit={submit} className="card mb-4 space-y-4 p-4">
          <div>
            <label className="label">Nama Pos</label>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="mis. Beli Bahan, Jasa Tukang, Transport"
              className="input text-lg"
              autoFocus
              required
            />
          </div>
          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setErr(""); setNama(""); }}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600"
            >
              Batal
            </button>
            <button disabled={busy} className="btn-primary flex-1">
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-gray-100">
        {pos.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada pos biaya.</div>
        )}
        {pos.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`icon-tile !h-9 !w-9 ${p.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
              <Icon name="receipt" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${p.is_active ? "" : "text-gray-400 line-through"}`}>{p.nama}</p>
              {!p.is_active && <p className="text-xs text-gray-400">Nonaktif</p>}
            </div>
            <button
              onClick={() => toggleAktif(p)}
              disabled={busyId === p.id}
              className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 active:bg-gray-100 disabled:opacity-50"
            >
              {busyId === p.id ? "..." : p.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
