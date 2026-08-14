"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { rupiah } from "@/lib/format";

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

const tglPendek = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function BiayaProyekManager({ proyekId, posList = [], initialBiaya = [], initialPenerimaan = [] }) {
  const [biaya, setBiaya] = useState(initialBiaya);
  const [penerimaan, setPenerimaan] = useState(initialPenerimaan);
  const [tab, setTab] = useState("biaya");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const [posId, setPosId] = useState("");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());

  const totalBiaya = useMemo(() => biaya.reduce((s, b) => s + Number(b.nominal || 0), 0), [biaya]);
  const totalPenerimaan = useMemo(() => penerimaan.reduce((s, p) => s + Number(p.nominal || 0), 0), [penerimaan]);
  const profitLoss = totalPenerimaan - totalBiaya;

  const rekapPos = useMemo(() => {
    const map = new Map();
    for (const b of biaya) {
      const nama = b.pos?.nama || "Tanpa Pos";
      map.set(nama, (map.get(nama) || 0) + Number(b.nominal || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [biaya]);

  const bukaForm = (t) => {
    setTab(t);
    setShowForm(true);
    setErr("");
    setPosId("");
    setNominal("");
    setKeterangan("");
    setTanggal(todayStr());
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");

    const url = tab === "biaya" ? "/api/biaya-proyek" : "/api/penerimaan-proyek";
    const body =
      tab === "biaya"
        ? { proyek_id: proyekId, pos_id: posId, nominal, keterangan, tanggal }
        : { proyek_id: proyekId, nominal, keterangan, tanggal };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setErr(json.error || "Gagal menyimpan.");

    if (tab === "biaya") {
      const posNama = posList.find((p) => p.id === posId)?.nama || "";
      setBiaya((list) => [{ ...json, pos: { nama: posNama } }, ...list]);
    } else {
      setPenerimaan((list) => [json, ...list]);
    }
    setShowForm(false);
  };

  const hapus = async (item, jenis) => {
    if (!confirm("Hapus catatan ini?")) return;
    setBusyId(item.id);
    const url = jenis === "biaya" ? "/api/biaya-proyek" : "/api/penerimaan-proyek";
    const res = await fetch(`${url}?id=${item.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Gagal menghapus.");
    }
    if (jenis === "biaya") setBiaya((list) => list.filter((b) => b.id !== item.id));
    else setPenerimaan((list) => list.filter((p) => p.id !== item.id));
  };

  return (
    <div>
      {/* Ringkasan */}
      <div className="card mb-4 p-4 space-y-3">
        <div className="flex divide-x divide-gray-100">
          <div className="flex-1">
            <p className="text-[11px] text-gray-400">Total Penerimaan</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(totalPenerimaan)}</p>
          </div>
          <div className="flex-1 pl-3">
            <p className="text-[11px] text-gray-400">Total Biaya</p>
            <p className="text-sm font-bold text-gray-800">{rupiah(totalBiaya)}</p>
          </div>
        </div>
        <div className={`rounded-xl p-3 ${profitLoss >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className={`text-[11px] ${profitLoss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {profitLoss >= 0 ? "Profit" : "Loss"}
          </p>
          <p className={`text-lg font-bold ${profitLoss >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {rupiah(Math.abs(profitLoss))}
          </p>
        </div>
      </div>

      {/* Rekap per pos */}
      {rekapPos.length > 0 && (
        <div className="card mb-4 divide-y divide-gray-100">
          <div className="px-4 py-2.5">
            <p className="font-bold text-gray-700 text-sm">Biaya per Pos</p>
          </div>
          {rekapPos.map(([nama, total]) => (
            <div key={nama} className="flex items-center justify-between px-4 py-2.5">
              <p className="text-sm text-gray-600">{nama}</p>
              <p className="text-sm font-semibold text-gray-800">{rupiah(total)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => { setTab("biaya"); setShowForm(false); }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === "biaya" ? "bg-white text-brand shadow-sm" : "text-gray-500"}`}
        >
          Biaya
        </button>
        <button
          type="button"
          onClick={() => { setTab("penerimaan"); setShowForm(false); }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === "penerimaan" ? "bg-white text-brand shadow-sm" : "text-gray-500"}`}
        >
          Penerimaan
        </button>
      </div>

      {tab === "biaya" && posList.length === 0 && !showForm && (
        <p className="mb-3 text-center text-xs text-gray-400">
          Belum ada pos biaya aktif. <Link href="/finance/pos-biaya" className="font-semibold text-brand">Tambah pos biaya</Link> dulu.
        </p>
      )}

      {!showForm ? (
        <button
          onClick={() => bukaForm(tab)}
          disabled={tab === "biaya" && posList.length === 0}
          className="btn-primary btn-lg mb-4 w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Icon name="plus" className="h-5 w-5" />
          {tab === "biaya" ? "Tambah Biaya" : "Tambah Penerimaan"}
        </button>
      ) : (
        <form onSubmit={submit} className="card mb-4 space-y-4 p-4">
          {tab === "biaya" && (
            <div>
              <label className="label">Pos Biaya</label>
              <select value={posId} onChange={(e) => setPosId(e.target.value)} className="input text-lg" required>
                <option value="" disabled>Pilih pos</option>
                {posList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Nominal (Rp)</label>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              placeholder="0"
              className="input text-lg"
              required
            />
          </div>
          <div>
            <label className="label">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="input text-lg"
              required
            />
          </div>
          <div>
            <label className="label">Keterangan (opsional)</label>
            <input
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder={tab === "biaya" ? "mis. Semen 20 sak" : "mis. Termin 1"}
              className="input text-lg"
            />
          </div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>}
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
        {tab === "biaya" ? (
          biaya.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Belum ada biaya tercatat.</div>
          ) : (
            biaya.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{b.pos?.nama || "Tanpa Pos"}</p>
                    <span className="shrink-0 text-xs text-gray-400">{tglPendek(b.tanggal)}</span>
                  </div>
                  {b.keterangan && <p className="truncate text-xs text-gray-500">{b.keterangan}</p>}
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-800">{rupiah(b.nominal)}</p>
                <button
                  onClick={() => hapus(b, "biaya")}
                  disabled={busyId === b.id}
                  className="shrink-0 text-gray-300 active:text-red-500 disabled:opacity-50"
                >
                  <Icon name="x-circle" className="h-5 w-5" />
                </button>
              </div>
            ))
          )
        ) : penerimaan.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada penerimaan tercatat.</div>
        ) : (
          penerimaan.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{p.keterangan || "Penerimaan"}</p>
                  <span className="shrink-0 text-xs text-gray-400">{tglPendek(p.tanggal)}</span>
                </div>
              </div>
              <p className="shrink-0 text-sm font-bold text-gray-800">{rupiah(p.nominal)}</p>
              <button
                onClick={() => hapus(p, "penerimaan")}
                disabled={busyId === p.id}
                className="shrink-0 text-gray-300 active:text-red-500 disabled:opacity-50"
              >
                <Icon name="x-circle" className="h-5 w-5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
