import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import AbsensiPegawaiSlot from "@/components/AbsensiPegawaiSlot";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// Dashboard Staff: absensi pegawai dan tombol Project Tracker. Sengaja tidak
// ada menu lain.
export default async function DashboardStaff() {
  const { profile, supabase } = await getSessionProfile();

  const jam = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()),
  );
  const sapa = jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-4">
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-medium text-brand">Staff</p>
          <h1 className="text-lg font-bold tracking-tight">
            {sapa}, {profile.name}!
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/staff/profil"
            aria-label="Profil"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-card active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <AbsensiPegawaiSlot supabase={supabase} profile={profile} />

      <Link href="/portal" className="card-tap flex items-center gap-3 p-4 active:opacity-70">
        <span className="icon-tile !rounded-full bg-amber-100 text-amber-700">
          <Icon name="share" />
        </span>
        <p className="flex-1 text-sm font-semibold text-gray-700">Project Tracker</p>
        <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-gray-300" />
      </Link>
    </main>
  );
}
