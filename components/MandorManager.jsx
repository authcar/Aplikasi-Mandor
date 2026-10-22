"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

// Dipakai di /master/kelola-akun dan /supervisor/mandor.
export default function MandorManager({ initialMandors }) {
  const [mandors, setMandors] = useState(initialMandors);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [justCreated, setJustCreated] = useState(null); // { name, phone, pin }
  const [revealed, setRevealed] = useState(() => new Set());
  const [salinId, setSalinId] = useState(null);

  const toggleReveal = (id) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const salinSandi = async (id, password) => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setSalinId(id);
    setTimeout(() => setSalinId((cur) => (cur === id ? null : cur)), 2000);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");

    const res = await fetch("/api/mandor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emailOrUsername, phone }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setErr(json.error || "Gagal menyimpan.");

    const newMandor = { id: json.id, name: json.name, email: json.email, phone: json.phone, pin: json.pin };
    setMandors((m) => [...m, newMandor]);
    setRevealed((prev) => new Set(prev).add(json.id));
    setJustCreated({ name: json.name, phone: json.phone, pin: json.pin });
    setShowForm(false);
    setName("");
    setEmailOrUsername("");
    setPhone("");
  };

  const resetPin = async (mandor) => {
    let phone;
    if (!mandor.phone) {
      phone = prompt(`Nomor HP ${mandor.name} belum ada. Isi nomor HP (dipakai untuk login):`);
      if (!phone) return;
    } else if (!confirm(`Reset PIN untuk ${mandor.name}? PIN lama tidak akan berlaku lagi.`)) {
      return;
    }
    const res = await fetch("/api/mandor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mandor.id, phone }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Gagal reset PIN.");
    setMandors((m) => m.map((x) => (x.id === mandor.id ? { ...x, phone: json.phone, pin: json.pin } : x)));
    setRevealed((prev) => new Set(prev).add(mandor.id));
  };

  return (
    <div>
      {justCreated && (
        <div className="card mb-4 border-2 border-brand bg-brand-50 p-4">
          <p className="mb-1 text-sm font-bold text-brand-800">
            Akun {justCreated.name} berhasil dibuat
          </p>
          <p className="mb-1 text-center text-sm text-brand-700">
            4 digit terakhir HP: {justCreated.phone.slice(-4)}
          </p>
          <p className="mb-2 text-center text-3xl font-bold tracking-[0.15em] text-brand-800">
            {justCreated.pin}
          </p>
          <button
            onClick={() => salinSandi("baru", justCreated.pin)}
            className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 active:bg-brand-100"
          >
            <Icon name="copy" className="h-3.5 w-3.5" />
            {salinId === "baru" ? "Tersalin ✓" : "Salin PIN"}
          </button>
          <p className="mb-3 text-center text-xs text-brand-700">
            Sampaikan PIN ini ke {justCreated.name}. Login pakai 4 digit terakhir nomor HP + PIN.
            Bisa dilihat lagi kapan pun lewat daftar di bawah (ikon mata).
          </p>
          <button onClick={() => setJustCreated(null)} className="btn-primary w-full">
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
          Tambah Mandor
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
            <label className="label">Email atau Username (opsional)</label>
            <input
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              placeholder="nama@gmail.com atau budi123"
              className="input text-lg"
            />
            <p className="mt-1 text-xs text-gray-400">
              Hanya untuk login email lama. Boleh dikosongkan, login tetap lewat
              nomor HP + PIN.
            </p>
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
            <p className="mt-1 text-xs text-gray-400">
              Login mandor: 4 digit terakhir nomor ini + PIN yang dibuat otomatis.
            </p>
          </div>
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
        {mandors.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">
            Belum ada mandor.
          </div>
        )}
        {mandors.map((m) => {
          const isRevealed = revealed.has(m.id);
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="icon-tile !h-9 !w-9 bg-brand-50 text-brand-600">
                <Icon name="hard-hat" className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.name}</p>
                <p className="truncate text-xs text-gray-500">{m.phone || m.email || "—"}</p>
              </div>
              <button
                onClick={() => toggleReveal(m.id)}
                title={!m.pin ? "Belum ada PIN — klik Reset untuk membuat PIN" : ""}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 active:bg-gray-100"
              >
                <Icon name={isRevealed ? "eye-off" : "eye"} className="h-3.5 w-3.5" />
                {isRevealed ? (m.pin || "Reset dulu") : "PIN"}
              </button>
              {isRevealed && m.pin && (
                <button
                  onClick={() => salinSandi(m.id, m.pin)}
                  className="shrink-0 rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 active:bg-gray-100"
                  title="Salin PIN"
                >
                  <Icon name={salinId === m.id ? "check" : "copy"} className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => resetPin(m)}
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
