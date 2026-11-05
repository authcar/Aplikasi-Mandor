import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import HopNavbar from "@/components/HopNavbar";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Head of Production: absensi, laporan harian, Project Tracker, dan profil.
// middleware.js sudah menyaring role; ini lapis kedua.
export default async function HopLayout({ children }) {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "HEAD_OF_PRODUCTION") redirect("/");
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Head of Production" />
      {children}
      <HopNavbar />
    </div>
  );
}
