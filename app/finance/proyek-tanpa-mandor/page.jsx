import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function ProyekTanpaMandorPage() {
  const { supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, icon, supervisor:supervisor_id(name)")
    .eq("is_active", true)
    .is("mandor_id", null)
    .order("nama");

  return (
    <main className="p-4 pb-8">
      <BackButton href="/finance" />
      <h1 className="text-xl font-bold tracking-tight">Belum Ada Mandor</h1>
      <p className="mb-4 text-sm text-gray-500">
        Proyek aktif yang belum punya Mandor Penanggung Jawab
      </p>

      {(proyek || []).length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">
          Semua proyek aktif sudah punya Mandor.
        </div>
      ) : (
        <div className="card flex flex-col divide-y divide-gray-100">
          {proyek.map((p) => (
            <Link
              key={p.id}
              href={`/finance/proyek/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
            >
              <span className="icon-tile bg-brand-50 text-brand-600 !w-8 !h-8">
                <Icon name={p.icon || "building"} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-sm">{p.nama}</p>
                <p className="text-xs text-gray-500">{p.lokasi}</p>
                {p.supervisor?.name && (
                  <p className="text-xs text-gray-400">Supervisor: {p.supervisor.name}</p>
                )}
              </div>
              <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
