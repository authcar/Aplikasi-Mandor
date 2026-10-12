"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { rupiah } from "@/lib/format";

const BUAT_POS_BARU = "__buat_pos_baru__";

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

const tglPendek = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function BiayaProyekManager({ proyekId, posList = [], initialBiaya = [], initialPenerimaan = [] }) {
  const [pos, setPos] = useState(posList);
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

  // Pos baru bisa langsung dibuat dari form Biaya (tanpa pindah ke halaman
  // Pos Biaya) — lihat onPosChange & buatPosBaru di bawah.
  const [posBaruMode, setPosBaruMode] = useState(false);
  const [posBaruNama, setPosBaruNama] = useState("");
  const [posBaruBusy, setPosBaruBusy] = useState(false);
  const [posBaruErr, setPosBaruErr] = useState("");

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
    setPosBaruMode(false);
    setPosBaruNama("");
    setPosBaruErr("");
  };

  const onPosChange = (e) => {
    const val = e.target.value;
    if (val === BUAT_POS_BARU) {
      setPosBaruMode(true);
      setPosBaruNama("");
      setPosBaruErr("");
    } else {
      setPosId(val);
    }
  };

  const buatPosBaru = async () => {
    const nama = posBaruNama.trim();
    if (!nama) return;
    setPosBaruBusy(true);
    setPosBaruErr("");

    const res = await fetch("/api/pos-biaya", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama }),
    });
    const json = await res.json();
    setPosBaruBusy(false);

    if (!res.ok) return setPosBaruErr(json.error || "Gagal membuat pos.");

    setPos((list) => [...list, json].sort((a, b) => a.nama.localeCompare(b.nama)));
    setPosId(json.id);
    setPosBaruMode(false);
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
      const posNama = pos.find((p) => p.id === posId)?.nama || "";
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

      {!showForm ? (
        <button
          onClick={() => bukaForm(tab)}
          className="btn-primary btn-lg mb-4 w-full flex items-center justify-center gap-2"
        >
          <Icon name="plus" className="h-5 w-5" />
          {tab === "biaya" ? "Tambah Biaya" : "Tambah Penerimaan"}
        </button>
      ) : (
        <form onSubmit={submit} className="card mb-4 space-y-4 p-4">
          {tab === "biaya" && (
            <div>
              <label className="label">Pos Biaya</label>
              {!posBaruMode ? (
                <select value={posId} onChange={onPosChange} className="input text-lg" required>
                  <option value="" disabled>{pos.length ? "Pilih pos" : "Belum ada pos — buat baru"}</option>
                  {pos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                  <option value={BUAT_POS_BARU}>+ Tambah pos baru...</option>
                </select>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      value={posBaruNama}
                      onChange={(e) => setPosBaruNama(e.target.value)}
                      placeholder="mis. Beli Bahan"
                      className="input text-lg"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={buatPosBaru}
                      disabled={posBaruBusy || !posBaruNama.trim()}
                      className="btn-primary shrink-0 px-4 py-2.5 text-sm disabled:opacity-40"
                    >
                      {posBaruBusy ? "..." : "Buat"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPosBaruMode(false); setPosBaruErr(""); }}
                      className="shrink-0 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600"
                    >
                      Batal
                    </button>
                  </div>
                  {posBaruErr && <p className="mt-1.5 text-sm font-medium text-red-600">{posBaruErr}</p>}
                </div>
              )}
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
