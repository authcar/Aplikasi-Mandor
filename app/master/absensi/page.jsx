import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AbsensiMasterPage() {
  const { supabase } = await getSessionProfile();

  const today = new Date().toISOString().slice(0, 10);

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, icon, mandor:mandor_id(name)")
    .eq("is_active", true)
    .order("nama");

  const proyekIds = (proyek || []).map((p) => p.id);

  const { data: absensi } = proyekIds.length
    ? await supabase
        .from("absensi_ringkas")
        .select("proyek_id, jumlah_hadir")
        .in("proyek_id", proyekIds)
        .eq("tanggal", today)
    : { data: [] };

  const absensiMap = Object.fromEntries(
    (absensi || []).map((a) => [a.proyek_id, a.jumlah_hadir])
  );

  const totalHadir = (absensi || []).reduce((sum, a) => sum + (a.jumlah_hadir || 0), 0);
  const proyekAbsen = (proyek || []).filter((p) => absensiMap[p.id] == null).length;

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Absensi Mandor</h1>
      <p className="mb-4 text-sm text-gray-500">
        {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Hadir Hari Ini</p>
          <p className="text-3xl font-bold text-emerald-600">{totalHadir}</p>
          <p className="text-xs text-gray-400">orang</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Belum Absen</p>
          <p className="text-3xl font-bold text-amber-500">{proyekAbsen}</p>
          <p className="text-xs text-gray-400">proyek</p>
        </div>
      </div>

      {/* List per proyek */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-bold text-gray-700 text-sm">Per Proyek ({proyek?.length || 0})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(proyek || []).map((p) => {
            const hadir = absensiMap[p.id];
            const sudahAbsen = hadir != null;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="icon-tile bg-brand-50 text-brand-600 !w-9 !h-9 shrink-0">
                  <Icon name={p.icon || "building"} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.nama}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.mandor?.name || "Belum ada mandor"} · {p.lokasi || "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {sudahAbsen ? (
                    <>
                      <p className="text-lg font-bold text-emerald-600">{hadir}</p>
                      <p className="text-[10px] text-gray-400">orang hadir</p>
                    </>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                      Belum
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(proyek || []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">Belum ada proyek aktif.</div>
          )}
        </div>
      </div>
    </main>
  );
}
