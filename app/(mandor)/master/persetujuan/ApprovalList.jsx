"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";
import Icon from "@/components/Icon";

const TABS = [
  { key: "SEMUA",    label: "Semua" },
  { key: "PENDING",  label: "Dikirim" },
  { key: "APPROVED", label: "Disetujui" },
  { key: "REJECTED", label: "Ditolak" },
];

const HALAMAN = 20;

const STATUS_STYLE = {
  PENDING:  "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_LABEL = {
  PENDING:  "Dikirim",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export default function ApprovalList({ items: initialItems }) {
  const router = useRouter();
  const [tab, setTab] = useState("SEMUA");
  const [busy, setBusy] = useState(null);
  const [items, setItems] = useState(initialItems);
  const [nota, setNota] = useState(null);
  const [unduh, setUnduh] = useState(false);
  const [tolakFor, setTolakFor] = useState(null);
  const [alasanTolak, setAlasanTolak] = useState("");
  const [errTolak, setErrTolak] = useState("");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(HALAMAN);
  const [filterOpen, setFilterOpen] = useState(false);
  const [proyekFilter, setProyekFilter] = useState([]);
  const [labelFilter, setLabelFilter] = useState([]);
  const [urutan, setUrutan] = useState("TERBARU");

  useEffect(() => setVisible(HALAMAN), [tab, q, proyekFilter, labelFilter, urutan]);

  const proyekOptions = useMemo(
    () => [...new Set(items.map((i) => i._proyek).filter(Boolean))].sort(),
    [items]
  );
  const labelOptions = useMemo(
    () => [...new Set(items.map((i) => i._label).filter(Boolean))].sort(),
    [items]
  );
  const jumlahFilterAktif = proyekFilter.length + labelFilter.length + (urutan !== "TERBARU" ? 1 : 0);

  const toggleDalamArray = (arr, setArr, value) =>
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);

  const resetFilter = () => {
    setProyekFilter([]);
    setLabelFilter([]);
    setUrutan("TERBARU");
  };

  const norm = (s) => (s || "").toLowerCase();
  const matchesQuery = (it) => {
    if (!q.trim()) return true;
    const needle = norm(q);
    return (
      norm(it._judul).includes(needle) ||
      norm(it._proyek).includes(needle) ||
      norm(it._mandor).includes(needle) ||
      norm(it._label).includes(needle)
    );
  };

  const filtered = items
    .filter((i) => (tab === "SEMUA" || i._status === tab) && matchesQuery(i))
    .filter((i) => proyekFilter.length === 0 || proyekFilter.includes(i._proyek))
    .filter((i) => labelFilter.length === 0 || labelFilter.includes(i._label))
    .sort((a, b) =>
      urutan === "TERLAMA"
        ? a._tanggal?.localeCompare(b._tanggal)
        : b._tanggal?.localeCompare(a._tanggal)
    );
  const visibleItems = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  const review = async (tipe, id, aksi, catatan) => {
    setBusy(id);
    const res = await fetch("/api/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipe, id, aksi, catatan }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, _status: aksi === "APPROVED" ? "APPROVED" : "REJECTED" } : x
        )
      );
      batalTolak();
      router.refresh();
      return true;
    }
    alert(json.error || "Gagal memproses. Coba lagi.");
    return false;
  };

  const mulaiTolak = (id) => {
    setTolakFor(id);
    setAlasanTolak("");
    setErrTolak("");
  };

  const batalTolak = () => {
    setTolakFor(null);
    setAlasanTolak("");
    setErrTolak("");
  };

  // Kasbon/Reimburse yang ditolak wajib disertai alasan (lembur tidak,
  // lihat catatan di app/api/approval/route.js).
  const kirimTolak = async (tipe, id) => {
    if (tipe === "keuangan" && !alasanTolak.trim())
      return setErrTolak("Alasan penolakan wajib diisi.");
    await review(tipe, id, "REJECTED", alasanTolak.trim());
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

  const fmt = (tgl) =>
    tgl
      ? new Date(tgl).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "—";

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari uraian, proyek, atau nama..."
            className="input !py-2.5 !pl-10 !text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((o) => !o)}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            filterOpen ? "border-brand bg-brand-50 text-brand" : "border-gray-300 bg-white text-gray-500"
          }`}
        >
          <Icon name="filter" className="h-4 w-4" />
          {jumlahFilterAktif > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {jumlahFilterAktif}
            </span>
          )}
        </button>
      </div>

      {filterOpen && (
        <div className="card mb-3 space-y-3 p-3">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">Urutkan</p>
            <div className="flex gap-1.5">
              {[
                { key: "TERBARU", label: "Terbaru" },
                { key: "TERLAMA", label: "Terlama" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setUrutan(o.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    urutan === o.key ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {labelOptions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">Jenis</p>
              <div className="flex flex-wrap gap-1.5">
                {labelOptions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDalamArray(labelFilter, setLabelFilter, label)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      labelFilter.includes(label) ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {proyekOptions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">Proyek</p>
              <div className="flex flex-wrap gap-1.5">
                {proyekOptions.map((nama) => (
                  <button
                    key={nama}
                    type="button"
                    onClick={() => toggleDalamArray(proyekFilter, setProyekFilter, nama)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      proyekFilter.includes(nama) ? "bg-brand text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {nama}
                  </button>
                ))}
              </div>
            </div>
          )}

          {jumlahFilterAktif > 0 && (
            <button
              type="button"
              onClick={resetFilter}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-500 active:bg-gray-50"
            >
              <Icon name="x-circle" className="h-3.5 w-3.5" />
              Reset Filter
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => {
          const count = t.key === "SEMUA" ? items.length : items.filter((i) => i._status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? "text-brand" : "text-gray-400"
              }`}
            >
              {t.label}
              {count > 0 && t.key === "PENDING" && (
                <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white">{count}</span>
              )}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
          <Icon name="check-circle" className="h-9 w-9" />
          <p className="font-semibold">Tidak ada pengajuan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((it) => (
            <div key={it.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${STATUS_STYLE[it._status]}`}>
                    {STATUS_LABEL[it._status]}
                  </span>
                  <span className={`badge ${it._tipe === "lembur" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                    {it._label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-700">{rupiah(it._nominal)}</p>
                  {it._jam != null && (
                    <p className="text-xs text-gray-400">{it._jam} hari</p>
                  )}
                </div>
              </div>

              <p className="font-semibold text-gray-800">{it._judul}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {fmt(it._tanggal)} · {it._proyek} · {it._mandor}
              </p>

              {it._nota && (
                <button
                  onClick={() => setNota({ url: it._nota, judul: it._judul })}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
                >
                  <Icon name="receipt" className="h-4 w-4" />
                  Lihat nota
                </button>
              )}

              {it._status === "REJECTED" && it._catatanTolak && (
                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2">
                  <p className="text-xs font-bold text-red-700">Alasan Penolakan</p>
                  <p className="text-sm text-red-600">{it._catatanTolak}</p>
                </div>
              )}

              {it._status === "PENDING" && tolakFor === it.id && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <label className="label">Alasan Penolakan</label>
                  <textarea
                    value={alasanTolak}
                    onChange={(e) => setAlasanTolak(e.target.value)}
                    placeholder="Contoh: Nota tidak sesuai, keterangan kurang jelas..."
                    rows={2}
                    className="input"
                    autoFocus
                  />
                  {errTolak && <p className="text-sm font-medium text-red-600">{errTolak}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={batalTolak} disabled={busy === it.id} className="btn-outline text-gray-500">
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => kirimTolak(it._tipe, it.id)}
                      disabled={busy === it.id}
                      className="btn-danger"
                    >
                      {busy === it.id ? "Mengirim..." : "Kirim Penolakan"}
                    </button>
                  </div>
                </div>
              )}
              {it._status === "PENDING" && tolakFor !== it.id && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    disabled={busy === it.id}
                    onClick={() =>
                      it._tipe === "keuangan" ? mulaiTolak(it.id) : review(it._tipe, it.id, "REJECTED")
                    }
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
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + HALAMAN)}
          className="btn-outline mt-3 w-full"
        >
          Muat Lebih Banyak ({filtered.length - visible} lagi)
        </button>
      )}

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
              <button onClick={() => setNota(null)} className="px-2 text-2xl leading-none text-gray-400">×</button>
            </div>
            <div className="flex-1 overflow-auto rounded-lg bg-gray-50">
              {isPdf
                ? <iframe src={nota.url} title="Nota" className="h-[60vh] w-full rounded-lg" />
                : <img src={nota.url} alt="Nota" className="mx-auto max-h-[60vh] w-full rounded-lg object-contain" />
              }
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => setNota(null)} className="btn-outline">Tutup</button>
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
