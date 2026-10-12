"use client";
import { useState } from "react";
import MandorManager from "@/components/MandorManager";
import TukangHarianManager from "@/components/TukangHarianManager";

// Gabungan kelola akun Mandor + Tukang Harian dalam satu halaman, dipisah tab
// biar Master gak perlu pindah halaman untuk urusan yang sama (kelola akun).
export default function KelolaAkunTabs({ mandors = [], proyekList = [], workers = [] }) {
  const [tab, setTab] = useState("mandor");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setTab("mandor")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "mandor" ? "bg-white text-brand shadow-sm" : "text-gray-500"
          }`}
        >
          Mandor
        </button>
        <button
          type="button"
          onClick={() => setTab("tukang")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "tukang" ? "bg-white text-brand shadow-sm" : "text-gray-500"
          }`}
        >
          Tukang Harian
        </button>
      </div>

      {tab === "mandor" ? (
        <MandorManager initialMandors={mandors} />
      ) : proyekList.length ? (
        <TukangHarianManager proyekList={proyekList} initialWorkers={workers} />
      ) : (
        <div className="card p-6 text-center text-sm text-gray-400">Belum ada proyek aktif.</div>
      )}
    </div>
  );
}
