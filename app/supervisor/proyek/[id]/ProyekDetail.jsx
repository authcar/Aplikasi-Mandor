"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function ProyekDetail({ proyek, mandors, jumlahHadir }) {
  const router = useRouter();
  const supabase = createClient();
  const [mandorId, setMandorId] = useState(proyek.mandor_id || "");
  const [nama, setNama] = useState(proyek.nama);
  const [lokasi, setLokasi] = useState(proyek.lokasi || "");
  const [infoDirty, setInfoDirty] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);

  const simpanMandor = async (val) => {
    setMandorId(val);
    await supabase.from("proyek").update({ mandor_id: val || null }).eq("id", proyek.id);
    router.refresh();
  };

  const simpanInfo = async () => {
    if (!nama.trim()) return;
    setInfoSaving(true);
    await supabase.from("proyek").update({ nama: nama.trim(), lokasi: lokasi.trim() }).eq("id", proyek.id);
    setInfoSaving(false);
    setInfoDirty(false);
    router.refresh();
  };

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <header className="mb-5 flex items-center gap-3">
        <span className="icon-tile bg-brand-50 text-brand-600">
          <Icon name={proyek.icon || "building"} />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{proyek.nama}</h1>
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <Icon name="map-pin" className="h-4 w-4 shrink-0" />
            {proyek.lokasi || "—"}
          </p>
        </div>
      </header>

      <div className="card p-4 mb-5 space-y-3">
        <p className="font-bold text-gray-700 text-sm">Info Proyek</p>
        <div>
          <label className="label">Nama Proyek</label>
          <input
            value={nama}
            onChange={(e) => { setNama(e.target.value); setInfoDirty(true); }}
            className="input text-lg"
            required
          />
        </div>
        <div>
          <label className="label">Lokasi</label>
          <input
            value={lokasi}
            onChange={(e) => { setLokasi(e.target.value); setInfoDirty(true); }}
            className="input text-lg"
          />
        </div>
        {infoDirty && (
          <button
            onClick={simpanInfo}
            disabled={infoSaving || !nama.trim()}
            className="btn-primary w-full"
          >
            {infoSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        )}
      </div>

      <div className="card p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Hadir Hari Ini</p>
          <p className="text-2xl font-bold">
            {jumlahHadir === null ? "—" : `${jumlahHadir} orang`}
          </p>
        </div>
        <span className="icon-tile bg-green-100 text-green-600">
          <Icon name="check-circle" />
        </span>
      </div>

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
    </main>
  );
}
