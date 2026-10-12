import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import EditableNama from "@/components/EditableNama";

export const dynamic = "force-dynamic";

export default async function ProfilFinancePage() {
  const { profile } = await getSessionProfile();

  return (
    <main className="p-4 pb-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Profil</h1>

      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-3xl font-bold">
          {profile.name?.[0]?.toUpperCase() ?? "F"}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{profile.name}</p>
          <p className="text-sm text-brand font-semibold">Finance</p>
        </div>
      </div>

      <div className="card divide-y divide-gray-100 mb-4">
        <EditableNama id={profile.id} initialName={profile.name} />
      </div>

      <LogoutButton className="w-full" />
    </main>
  );
}
