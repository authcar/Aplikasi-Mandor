import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardSupervisor() {
  const { profile, supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, mandor:mandor_id(name)")
    .eq("supervisor_id", profile.id)
    .eq("is_active", true);

  const [{ count: l }, { count: k }] = await Promise.all([
    supabase.from("lembur").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("keuangan").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);
  const pending = (l || 0) + (k || 0);

  return (
    <main className="p-4 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Supervisor</p>
          <h1 className="text-xl font-bold">{profile.name}</h1>
        </div>
        <LogoutButton />
      </header>

      <Link
        href="/supervisor/persetujuan"
        className="mb-5 flex items-center justify-between rounded-2xl bg-brand p-5 text-white active:opacity-90"
      >
        <div>
          <p className="text-sm opacity-90">Menunggu Persetujuan</p>
          <p className="text-3xl font-bold">{pending}</p>
        </div>
        <span className="text-2xl">›</span>
      </Link>

      <h2 className="mb-2 font-semibold text-gray-600">Proyek Saya ({proyek?.length || 0})</h2>
      <div className="space-y-3">
        {(proyek || []).map((p) => (
          <Link
            key={p.id}
            href={`/supervisor/proyek/${p.id}`}
            className="block rounded-2xl border-2 border-gray-200 bg-white p-4 active:bg-gray-100"
          >
            <p className="font-semibold">{p.nama}</p>
            <p className="text-sm text-gray-500">
              {p.lokasi} · Mandor: {p.mandor?.name || "-"}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
