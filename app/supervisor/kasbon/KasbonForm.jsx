"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import { rupiah } from "@/lib/format";

const STATUS_BADGE = {
  PENDING: { label: "Menunggu", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "✓ Disetujui", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Ditolak", cls: "bg-red-100 text-red-700" },
};

// Kasbon Supervisor — disetujui Master (bukan Supervisor lain), dan kalau
// disetujui otomatis jadi potongan di Rekap Gaji bulan ini (lihat
// app/supervisor/gaji/page.jsx).
export default function KasbonForm({ proyekList = [], riwayat = [] }) {
  const router = useRouter();
  const [proyekId, setProyekId] = useState(proyekList[0]?.id || "");
  const [nominal, setNominal] = useState("");
  const [ket, setKet] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [daftar, setDaftar] = useState(riwayat);

  const submit = async (e) => {
    e.preventDefault();
    if (!proyekId) return setErr("Belum ada proyek aktif.");
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("proyek_id", proyekId);
      fd.append("jenis", "KASBON");
      fd.append("nominal", nominal);
      fd.append("keterangan", ket);
      const res = await fetch("/api/keuangan", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal mengirim. Coba lagi.");
      setDaftar((d) => [json.data, ...d]);
      setNominal("");
      setKet("");
      setBusy(false);
      router.refresh();
    } catch (e) {
      setErr(
        e instanceof TypeError
          ? "Gagal terhubung ke server. Periksa koneksi internet lalu coba lagi."
          : e.message || "Gagal mengirim. Coba lagi."
      );
      setBusy(false);
    }
  };

  if (!proyekList.length) {
    return (
      <main className="p-4">
        <BackButton href="/supervisor" />
        <p className="p-6 text-center text-sm text-gray-400">Belum ada proyek aktif.</p>
      </main>
    );
  }

  return (
    <main className="p-4">
      <BackButton href="/supervisor" />
      <h1 className="text-xl font-bold tracking-tight">Kasbon</h1>
      <p className="mb-4 text-sm text-gray-500">Diajukan ke Master untuk disetujui</p>

      <form onSubmit={submit} className="space-y-4">
        {proyekList.length > 1 && (
          <Field label="Proyek">
            <select value={proyekId} onChange={(e) => setProyekId(e.target.value)} className="input text-lg">
              {proyekList.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Nominal (Rp)">
          <input
            inputMode="numeric"
            value={nominal}
            onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
            className="input text-lg"
            placeholder="500000"
            required
          />
        </Field>
        <Field label="Keperluan">
          <input
            value={ket}
            onChange={(e) => setKet(e.target.value)}
            className="input text-lg"
            placeholder="Kasbon keperluan pribadi"
            required
          />
        </Field>

        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>
        )}

        <button disabled={busy} className="btn-primary btn-lg w-full">
          {busy ? "Mengirim..." : "KIRIM KE MASTER"}
        </button>
      </form>

      {daftar.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-bold text-gray-700">Riwayat Kasbon</h2>
          <div className="space-y-3">
            {daftar.map((it) => {
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
