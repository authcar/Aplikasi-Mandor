"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import KameraModal from "@/components/KameraModal";

const SATUAN = ["pcs", "kg", "sak", "dus", "m", "m²", "roll", "lembar", "batang", "lonjor", "liter", "unit", "set", "karung"];
const URGENSI = ["Mendesak", "Sedang", "Rendah"];

const URGENSI_BADGE = {
  Mendesak: "bg-red-100 text-red-700",
  Sedang: "bg-amber-100 text-amber-700",
  Rendah: "bg-blue-100 text-blue-700",
};

const STATUS_LABEL = {
  OPEN: { label: "Menunggu", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  DONE: { label: "Sudah Datang", cls: "text-green-500" },
};

const HALAMAN = 20;

export default function MasalahForm({ proyeks = [], laporan = [] }) {
  const router = useRouter();
  const supabase = createClient();

  const [proyekId, setProyekId] = useState(proyeks[0]?.id || "");
  const [material, setMaterial] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [satuan, setSatuan] = useState("pcs");
  const [urgensi, setUrgensi] = useState("Sedang");
  const [catatan, setCatatan] = useState("");
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [daftar, setDaftar] = useState(laporan);
  const [hasMore, setHasMore] = useState(laporan.length === HALAMAN);
  const [loadingMore, setLoadingMore] = useState(false);

  const pilihFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const pakaiFoto = (file) => {
    setFoto(file);
    setPreview(URL.createObjectURL(file));
    setKameraOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!proyekId || !material || !jumlah) return;
    setBusy(true);
    setErr("");
    try {
      const uid = (await supabase.auth.getUser()).data.user.id;
      let foto_url = null;
      if (foto) {
        const ext = foto.name.split(".").pop();
        const path = `${proyekId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("masalah").upload(path, foto);
        if (upErr) throw new Error("Gagal upload foto: " + upErr.message);
        foto_url = path;
      }
      const { data: created, error } = await supabase
        .from("masalah")
        .insert({
          proyek_id: proyekId,
          judul: material,
          deskripsi: catatan,
          foto_url,
          material,
          jumlah: parseFloat(jumlah),
          satuan,
          urgensi,
          created_by: uid,
        })
        .select("id, judul, material, jumlah, satuan, urgensi, deskripsi, status, created_at")
        .single();
      if (error) throw new Error("Gagal mengirim laporan: " + error.message);

      const proyekNama = proyeks.find((p) => p.id === proyekId)?.nama || null;
      setDaftar((d) => [{ ...created, catatan: created.deskripsi, proyek: proyekNama }, ...d]);

      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe: "masalah",
          proyek_id: proyekId,
          ringkasan: `${material} — ${jumlah} ${satuan} (${urgensi})`,
        }),
      }).catch(() => {});

      setMaterial("");
      setJumlah("");
      setCatatan("");
      setUrgensi("Sedang");
      setFoto(null);
      setPreview(null);
      router.refresh();
    } catch (e) {
      setErr(
        e instanceof TypeError
          ? "Gagal terhubung ke server. Periksa koneksi internet lalu coba lagi."
          : e.message || "Gagal mengirim laporan. Coba lagi."
      );
    } finally {
      setBusy(false);
    }
  };

  const muatLagi = async () => {
    setLoadingMore(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    const { data: rows } = await supabase
      .from("masalah")
      .select("id, judul, material, jumlah, satuan, urgensi, deskripsi, status, created_at, proyek(nama)")
      .eq("created_by", uid)
      .order("created_at", { ascending: false })
      .range(daftar.length, daftar.length + HALAMAN - 1);
    const next = (rows || []).map((r) => ({ ...r, catatan: r.deskripsi, proyek: r.proyek?.nama || null }));
    setDaftar((d) => [...d, ...next]);
    setHasMore(next.length === HALAMAN);
    setLoadingMore(false);
  };

  if (proyeks.length === 0)
    return <p className="p-6 text-gray-500">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4 pb-10">
      {kameraOpen && (
        <KameraModal
          title="Foto Material"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}
      <BackButton href={`/tukang-harian?proyek=${proyekId}`} />

      {/* Form Card */}
      <div className="card mb-6 p-5 shadow-sm">
        <h1 className="mb-4 text-lg font-bold tracking-tight">Laporkan Kekurangan Material</h1>
        <form onSubmit={submit} className="space-y-4">
          {/* Proyek */}
          <div>
            <label className="label">Proyek</label>
            <select
              value={proyekId}
              onChange={(e) => setProyekId(e.target.value)}
              className="input"
              required
            >
              {proyeks.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>

          {/* Material */}
          <div>
            <label className="label">Material</label>
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Contoh: Besi WF 150, Triplek 18mm..."
              className="input"
              required
            />
          </div>

          {/* Jumlah + Satuan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jumlah</label>
              <input
                type="number"
                min="0"
                step="any"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                placeholder="0"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Satuan</label>
              <select
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
                className="input"
              >
                {SATUAN.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Urgensi */}
          <div>
            <label className="label">Urgensi</label>
            <div className="flex gap-2">
              {URGENSI.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgensi(u)}
                  className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-colors ${
                    urgensi === u
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="label">Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Jelaskan dampak kekurangan ini..."
              rows={3}
              className="input"
            />
          </div>

          {/* Foto */}
          <div>
            <label className="label">Foto (opsional)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKameraOpen(true)}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                Kamera
              </button>
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M6.75 6.75h.008v.008H6.75V6.75zM12 3.75h.008v.008H12V3.75z" />
                </svg>
                Galeri
                <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
              </label>
            </div>
            {preview && (
              <div className="relative mt-2">
                <img src={preview} alt="preview" className="w-full rounded-xl border border-gray-200 object-cover max-h-52" />
                <button
                  type="button"
                  onClick={() => { setFoto(null); setPreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>
          )}

          <button disabled={busy} className="btn-primary btn-lg w-full">
            {busy ? "Mengirim..." : "Kirim Laporan"}
          </button>
        </form>
      </div>


      {daftar.length > 0 && (
        <section>
          <h2 className="mb-3 font-bold text-gray-700">Riwayat Pelaporan</h2>
          <div className="space-y-3">
            {daftar.map((it) => {
              const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
              return (
                <div key={it.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${URGENSI_BADGE[it.urgensi] || "bg-gray-100 text-gray-600"}`}>
                      {it.urgensi || "Sedang"}
                    </span>
                    {it.status === "DONE" ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-500">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Sudah Datang
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    )}
                  </div>
                  <p className="font-semibold">{it.material || it.judul}</p>
                  <p className="text-sm text-gray-500">
                    {it.jumlah} {it.satuan}
                    {it.proyek ? ` · ${it.proyek}` : ""}
                  </p>
                  {it.catatan && (
                    <p className="mt-1 text-sm text-gray-400">{it.catatan}</p>
                  )}
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={muatLagi}
              disabled={loadingMore}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-600 active:bg-gray-100"
            >
              {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
