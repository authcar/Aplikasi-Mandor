"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

// Dipakai di /mandor/tukang-harian dan /supervisor/tukang-harian.
// basePath cuma dipakai kalau nanti perlu link balik ke halaman lain per-role.
export default function TukangHarianManager({ proyekList, initialWorkers }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [proyekId, setProyekId] = useState(proyekList[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [justCreated, setJustCreated] = useState(null); // { name, pin }
  const [revealed, setRevealed] = useState(() => new Set());

  const proyekNama = (id) => proyekList.find((p) => p.id === id)?.nama || "—";

  const toggleReveal = (id) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!proyekId) return setErr("Pilih proyek dulu.");
    setBusy(true);
    setErr("");

    const res = await fetch("/api/tukang-harian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, proyek_id: proyekId }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setErr(json.error || "Gagal menyimpan.");

    const newWorker = { id: json.id, name: json.name, phone: json.phone, proyek_id: json.proyek_id, pin: json.pin };
    setWorkers((w) => [...w, newWorker]);
    setRevealed((prev) => new Set(prev).add(json.id));
    setJustCreated({ name: json.name, pin: json.pin });
    setShowForm(false);
    setName("");
    setPhone("");
  };

  const resetPin = async (worker) => {
    if (!confirm(`Reset PIN untuk ${worker.name}? PIN lama tidak akan berlaku lagi.`)) return;
    const res = await fetch("/api/tukang-harian", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: worker.id }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Gagal reset PIN.");
    setWorkers((w) => w.map((x) => (x.id === worker.id ? { ...x, pin: json.pin } : x)));
    setRevealed((prev) => new Set(prev).add(worker.id));
  };

  return (
    <div>
      {justCreated && (
        <div className="card mb-4 border-2 border-brand bg-brand-50 p-4">
          <p className="mb-1 text-sm font-bold text-brand-800">
            Akun {justCreated.name} berhasil dibuat
          </p>
          <p className="mb-2 text-center text-4xl font-bold tracking-[0.3em] text-brand-800">
            {justCreated.pin}
          </p>
          <p className="mb-3 text-center text-xs text-brand-700">
            Sampaikan PIN ini ke {justCreated.name}. PIN ini bisa dilihat lagi kapan pun lewat
            daftar di bawah (ikon mata).
          </p>
          <button
            onClick={() => setJustCreated(null)}
            className="btn-primary w-full"
          >
            Tutup
          </button>
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary btn-lg mb-4 w-full flex items-center justify-center gap-2"
        >
          <Icon name="plus" className="h-5 w-5" />
          Tambah Tukang Harian
        </button>
      ) : (
        <form onSubmit={submit} className="card mb-4 space-y-4 p-4">
          <div>
            <label className="label">Nama</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              className="input text-lg"
              required
            />
          </div>
          <div>
            <label className="label">Nomor HP</label>
            <input
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08123456789"
              className="input text-lg"
              required
            />
          </div>
          {proyekList.length > 1 && (
            <div>
              <label className="label">Proyek</label>
              <select
                value={proyekId}
                onChange={(e) => setProyekId(e.target.value)}
                className="input text-lg"
                required
              >
                <option value="">— Pilih Proyek —</option>
                {proyekList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ))}
              </select>
            </div>
          )}
          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setErr(""); }}
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
        {workers.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">
            Belum ada tukang harian.
          </div>
        )}
        {workers.map((w) => {
          const isRevealed = revealed.has(w.id);
          return (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3">
              <span className="icon-tile !h-9 !w-9 bg-brand-50 text-brand-600">
                <Icon name="hard-hat" className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{w.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {w.phone || "—"} · {proyekNama(w.proyek_id)}
                </p>
              </div>
              <button
                onClick={() => toggleReveal(w.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold tabular-nums text-gray-600 active:bg-gray-100"
              >
                <Icon name={isRevealed ? "eye-off" : "eye"} className="h-3.5 w-3.5" />
                {isRevealed ? (w.pin || "—") : "PIN"}
              </button>
              <button
                onClick={() => resetPin(w)}
                className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 active:bg-gray-100"
              >
                Reset
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
