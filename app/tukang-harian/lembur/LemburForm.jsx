"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";

const TARIF = 80000;
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const STATUS_BADGE = {
  PENDING: { label: "Menunggu", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "✓ Disetujui", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Ditolak", cls: "bg-red-100 text-red-700" },
};

const HALAMAN = 10;

export default function LemburForm({ proyek, riwayat = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [hari, setHari] = useState("1");
  const [orang, setOrang] = useState("1");
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [daftar, setDaftar] = useState(riwayat);
  const [hasMore, setHasMore] = useState(riwayat.length === HALAMAN);
  const [loadingMore, setLoadingMore] = useState(false);

  const totalBiaya = Number(hari) * Number(orang) * TARIF;

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
    setBusy(true);
    setErr("");
    try {
      const uid = (await supabase.auth.getUser()).data.user.id;

      let foto_url = null;
      if (foto) {
        const ext = foto.name.split(".").pop();
        const path = `${proyek.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("lembur").upload(path, foto);
        if (upErr) throw new Error("Gagal upload foto: " + upErr.message);
        foto_url = path;
      }

      // jam = hari × orang, tarif_per_jam = 80000 → total = jam × tarif = hari × orang × 80000
      const { error } = await supabase.from("lembur").insert({
        proyek_id: proyek.id,
        tanggal,
        jam: Number(hari) * Number(orang),
        tarif_per_jam: TARIF,
        catatan: `${orang} orang × ${hari} hari`,
        foto_url,
        created_by: uid,
      });
      if (error) throw new Error("Gagal mengirim pengajuan lembur: " + error.message);

      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe: "lembur",
          proyek_id: proyek.id,
          ringkasan: `${orang} orang × ${hari} hari — ${rupiah(totalBiaya)}`,
        }),
      }).catch(() => {});

      router.push(`/tukang-harian?proyek=${proyek.id}`);
    } catch (e) {
      setErr(
        e instanceof TypeError
          ? "Gagal terhubung ke server. Periksa koneksi internet lalu coba lagi."
          : e.message || "Gagal mengirim pengajuan. Coba lagi."
      );
      setBusy(false);
    }
  };

  const muatLagi = async () => {
    setLoadingMore(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    const { data: rows } = await supabase
      .from("lembur")
      .select("id, jam, total, catatan, tanggal, status, created_at")
      .eq("proyek_id", proyek.id)
      .eq("created_by", uid)
      .order("created_at", { ascending: false })
      .range(daftar.length, daftar.length + HALAMAN - 1);
    setDaftar((d) => [...d, ...(rows || [])]);
    setHasMore((rows || []).length === HALAMAN);
    setLoadingMore(false);
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4">
      {kameraOpen && (
        <KameraModal
          title="Foto Bukti Lembur"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}
      <BackButton href={`/tukang-harian?proyek=${proyek.id}`} />
      <h1 className="mb-6 text-xl font-bold tracking-tight">Lembur</h1>

      <form onSubmit={submit} className="space-y-4">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Jumlah Hari</label>
            <input
              inputMode="decimal"
              value={hari}
              onChange={(e) => setHari(e.target.value)}
              className="input text-lg"
              placeholder="1"
              min="0.5"
              step="0.5"
              required
            />
          </div>
          <div>
            <label className="label">Jumlah Orang</label>
            <input
              inputMode="numeric"
              value={orang}
              onChange={(e) => setOrang(e.target.value.replace(/\D/g, ""))}
              onBlur={(e) => { if (!e.target.value) setOrang("1"); }}
              className="input text-lg"
              placeholder="1"
              min="1"
              required
            />
          </div>
        </div>

        {/* Preview total */}
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
          <p className="text-xs text-indigo-500 mb-1">{orang} orang × {hari} hari × {rupiah(TARIF)}</p>
          <p className="text-2xl font-bold text-indigo-700">{rupiah(totalBiaya)}</p>
        </div>

        {/* Foto bukti lembur */}
        <div>
          <label className="label">Foto Bukti (opsional)</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKameraOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
            >
              <Icon name="camera" className="h-5 w-5 text-gray-400" />
              Kamera
            </button>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 21h18M6.75 6.75h.008v.008H6.75V6.75z" />
              </svg>
              Galeri
              <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
            </label>
          </div>
          {preview && (
            <div className="relative mt-2">
              <img src={preview} alt="preview bukti lembur" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
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
          {busy ? "Mengirim..." : "AJUKAN KE SUPERVISOR"}
        </button>
      </form>

      {/* Riwayat pengajuan */}
      {daftar.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-bold text-gray-700">Riwayat Pengajuan</h2>
          <div className="space-y-3">
            {daftar.map((it) => {
              const badge = STATUS_BADGE[it.status] || STATUS_BADGE.PENDING;
              return (
                <div key={it.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{rupiah(it.total || 0)}</p>
                    <span className={`badge shrink-0 ${badge.cls}`}>{badge.label}</span>
                  </div>
                  {it.catatan && (
                    <p className="mt-0.5 text-sm text-gray-500">{it.catatan}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Lembur{" "}
                    {new Date(`${it.tanggal}T00:00:00`).toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
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
