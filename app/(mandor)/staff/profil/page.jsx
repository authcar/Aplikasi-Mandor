import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import LogoutButton from "@/components/LogoutButton";
import EditableNama from "@/components/EditableNama";
import UbahSandiCard from "@/components/UbahSandiCard";

export const dynamic = "force-dynamic";

export default async function ProfilStaffPage() {
  const { profile } = await getSessionProfile();

  return (
    <main className="p-4 pb-8">
      <BackButton href="/staff" />
      <h1 className="mb-6 text-xl font-bold tracking-tight">Profil</h1>

      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-3xl font-bold text-white">
          {profile.name?.[0]?.toUpperCase() ?? "S"}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{profile.name}</p>
          <p className="text-sm font-semibold text-brand">Staff</p>
        </div>
      </div>

      <div className="card mb-4 divide-y divide-gray-100">
        <EditableNama id={profile.id} initialName={profile.name} />
      </div>

      <UbahSandiCard />

      <LogoutButton className="w-full" />
    </main>
  );
}
