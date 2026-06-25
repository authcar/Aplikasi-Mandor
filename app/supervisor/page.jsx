import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardSupervisor() {
  const { profile, supabase } = await getSessionProfile();

  // Sapaan mengikuti jam (WIB).
  const jam = Number(
    new Intl.DateTimeFormat("id-ID", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date())
  );
  const sapa =
    jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, mandor:mandor_id(name)")
    .eq("supervisor_id", profile.id)
    .eq("is_active", true);

  const [{ count: l }, { count: k }, { count: m }] = await Promise.all([
    supabase.from("lembur").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("keuangan").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("masalah").select("id", { count: "exact", head: true }).neq("status", "DONE"),
  ]);
  const pending = (l || 0) + (k || 0);
  const masalahAktif = m || 0;

  return (
    <main className="p-4 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Supervisor</p>
          <h1 className="text-xl font-bold">
            {sapa}, {profile.name}!
          </h1>
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

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link
          href="/supervisor/masalah"
          className="flex items-center justify-between rounded-2xl border-2 border-gray-200 bg-white p-4 active:bg-gray-100"
        >
          <div>
            <p className="text-xs text-gray-500">Masalah Aktif</p>
            <p className="text-2xl font-bold">{masalahAktif}</p>
          </div>
          <span className="text-xl text-gray-400">›</span>
        </Link>

        <Link
          href="/supervisor/gaji"
          className="flex items-center justify-between rounded-2xl border-2 border-gray-200 bg-white p-4 active:bg-gray-100"
        >
          <div>
            <p className="text-xs text-gray-500">Rekap Gaji</p>
            <p className="text-2xl font-bold">💰</p>
          </div>
          <span className="text-xl text-gray-400">›</span>
        </Link>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-gray-600">Proyek Saya ({proyek?.length || 0})</h2>
        <Link
          href="/supervisor/proyek/baru"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          + Proyek Baru
        </Link>
      </div>
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
