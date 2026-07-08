"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import { rupiah } from "@/lib/format";

const STATUS_BADGE = {
  PENDING: { label: "Menunggu", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "✓ Disetujui", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Ditolak", cls: "bg-red-100 text-red-700" },
};

export default function ReimburseForm({ proyek, riwayat = [] }) {
  const router = useRouter();
  const [nominal, setNominal] = useState("");
  const [ket, setKet] = useState("");
  const [nota, setNota] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kameraOpen, setKameraOpen] = useState(false);

  const pilihFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNota(file);
    setPreview(URL.createObjectURL(file));
  };

  const pakaiFoto = (file) => {
    setNota(file);
    setPreview(URL.createObjectURL(file));
    setKameraOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.append("proyek_id", proyek.id);
    fd.append("jenis", "REIMBURSE");
    fd.append("nominal", nominal);
    fd.append("keterangan", ket);
    if (nota) fd.append("nota", nota);
    const res = await fetch("/api/keuangan", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) router.push(`/tukang-harian?proyek=${proyek.id}`);
    else alert("Gagal mengirim. Coba lagi.");
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <>
      {kameraOpen && (
        <KameraModal
          title="Foto Nota"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}
      <main className="p-4">
        <BackButton href={`/tukang-harian?proyek=${proyek.id}`} />
        <h1 className="text-xl font-bold tracking-tight">Reimburse / Klaim</h1>
        <p className="mb-4 text-sm text-gray-500">{proyek.nama}</p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nominal (Rp)">
            <input
              inputMode="numeric"
              value={nominal}
              onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
              className="input text-lg"
              placeholder="50000"
              required
            />
          </Field>
          <Field label="Untuk apa?">
            <input
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              className="input text-lg"
              placeholder="Uang makan tim"
              required
            />
          </Field>

          <Field label="Foto Nota / Kuitansi">
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
                <img src={preview} alt="preview nota" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
                <button
                  type="button"
                  onClick={() => { setNota(null); setPreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </Field>

          <button disabled={busy} className="btn-primary btn-lg w-full">
            {busy ? "Mengirim..." : "KIRIM KE SUPERVISOR"}
          </button>
        </form>

        {/* Riwayat pengajuan */}
        {riwayat.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 font-bold text-gray-700">Riwayat Pengajuan</h2>
            <div className="space-y-3">
              {riwayat.map((it) => {
                const badge = STATUS_BADGE[it.status] || STATUS_BADGE.PENDING;
                return (
                  <div key={it.id} className="card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{rupiah(it.nominal)}</p>
                      <span className={`badge shrink-0 ${badge.cls}`}>{badge.label}</span>
                    </div>
                    {it.keterangan && (
                      <p className="mt-0.5 text-sm text-gray-500">{it.keterangan}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(it.created_at).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jakarta",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
