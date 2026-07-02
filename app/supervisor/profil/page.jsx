import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function ProfilSupervisorPage() {
  const { profile } = await getSessionProfile();

  return (
    <main className="p-4 pb-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Profil</h1>

      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-3xl font-bold">
          {profile.name?.[0]?.toUpperCase() ?? "S"}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{profile.name}</p>
          <p className="text-sm text-brand font-semibold">Supervisor</p>
        </div>
      </div>

      <div className="card divide-y divide-gray-100 mb-4">
        <Row label="Nama" value={profile.name} />
        <Row label="Telepon" value={profile.phone || "—"} />
        <Row label="Gaji Pokok" value={
          profile.gaji_pokok
            ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(profile.gaji_pokok)
            : "—"
        } />
      </div>

      <LogoutButton className="w-full" />
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
