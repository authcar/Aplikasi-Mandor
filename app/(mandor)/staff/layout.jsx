import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import StaffNavbar from "@/components/StaffNavbar";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Staff: absensi, Project Tracker, dan profil (ubah sandi). Tidak ada menu lain.
// middleware.js sudah menyaring role; ini lapis kedua.
export default async function StaffLayout({ children }) {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "STAFF") redirect("/");
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Staff" />
      {children}
      <StaffNavbar />
    </div>
  );
}
