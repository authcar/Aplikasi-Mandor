"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function ProyekDetail({ proyek, tukangAwal, mandors }) {
  const router = useRouter();
  const supabase = createClient();
  const [tukang, setTukang] = useState(tukangAwal);
  const [mandorId, setMandorId] = useState(proyek.mandor_id || "");

  // form tambah tukang
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("Tukang");
  const [upah, setUpah] = useState("");
  const [busy, setBusy] = useState(false);

  const simpanMandor = async (val) => {
    setMandorId(val);
    await supabase.from("proyek").update({ mandor_id: val || null }).eq("id", proyek.id);
    router.refresh();
  };

  const tambahTukang = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("tukang")
      .insert({ proyek_id: proyek.id, nama, jabatan, upah_harian: Number(upah) })
      .select()
      .single();
    setBusy(false);
    if (!error && data) {
      setTukang((t) => [...t, data].sort((a, b) => a.nama.localeCompare(b.nama)));
      setNama("");
      setUpah("");
    }
  };

  const hapusTukang = async (id) => {
    await supabase.from("tukang").update({ is_active: false }).eq("id", id);
    setTukang((t) => t.map((x) => (x.id === id ? { ...x, is_active: false } : x)));
  };

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <header className="mb-5 flex items-center gap-3">
        <span className="icon-tile bg-brand-50 text-brand-600">
          <Icon name={proyek.icon || "building"} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{proyek.nama}</h1>
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <Icon name="map-pin" className="h-4 w-4" />
            {proyek.lokasi}
          </p>
        </div>
      </header>

      <div className="mb-6">
        <label className="label">Mandor Penanggung Jawab</label>
        <select
          value={mandorId}
          onChange={(e) => simpanMandor(e.target.value)}
          className="input text-lg"
        >
          <option value="">— Belum ditetapkan —</option>
          {mandors.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <h2 className="mb-2 font-bold text-gray-700">
        Daftar Tukang ({tukang.filter((t) => t.is_active).length})
      </h2>
      <div className="mb-5 space-y-2">
        {tukang.filter((t) => t.is_active).map((t) => (
          <div key={t.id} className="card flex items-center justify-between p-3.5">
            <div>
              <p className="font-semibold">{t.nama}</p>
              <p className="text-sm text-gray-500">{t.jabatan} · {rupiah(t.upah_harian)}/hari</p>
            </div>
            <button
              onClick={() => hapusTukang(t.id)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-500 active:bg-red-50"
            >
              Hapus
            </button>
          </div>
        ))}
        {tukang.filter((t) => t.is_active).length === 0 && (
          <p className="card p-5 text-center text-sm text-gray-400">
            Belum ada tukang. Tambahkan di bawah.
          </p>
        )}
      </div>

      <form onSubmit={tambahTukang} className="space-y-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4">
        <p className="flex items-center gap-1.5 font-bold text-gray-700">
          <Icon name="plus" className="h-4 w-4" />
          Tambah Tukang
        </p>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Nama tukang"
          className="input text-lg"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={jabatan}
            onChange={(e) => setJabatan(e.target.value)}
            className="input text-lg"
          >
            <option>Tukang</option>
            <option>Kenek</option>
            <option>Kepala Tukang</option>
          </select>
          <input
            inputMode="numeric"
            value={upah}
            onChange={(e) => setUpah(e.target.value.replace(/\D/g, ""))}
            placeholder="Upah/hari"
            className="input text-lg"
            required
          />
        </div>
        <button disabled={busy} className="btn-primary w-full">
          {busy ? "Menyimpan..." : "+ Tambah"}
        </button>
      </form>
    </main>
  );
}
