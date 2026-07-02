import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function TukangHarianPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/tukang-harian-login");
  if (profile?.role !== "TUKANG_HARIAN") redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-700 px-5 pb-6 pt-10 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-100">Selamat datang,</p>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="mt-0.5 text-sm text-amber-100">Tukang Harian</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <Icon name="hammer" className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Icon name="calendar" className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Hari ini</p>
            <p className="font-semibold text-gray-900">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="card p-5 text-center text-gray-400">
          <Icon name="clipboard" className="mx-auto mb-2 h-10 w-10 opacity-40" />
          <p className="text-sm">Fitur absensi tukang harian segera hadir.</p>
        </div>
      </div>

      {/* Logout */}
      <div className="p-5">
        <LogoutButton />
      </div>
    </div>
  );
}
