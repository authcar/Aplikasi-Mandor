import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Head of Production: dashboard sederhana (absensi, laporan harian, Project
// Tracker), tanpa navbar bawah. middleware.js sudah menyaring role; ini lapis kedua.
export default async function HopLayout({ children }) {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "HEAD_OF_PRODUCTION") redirect("/");
  return (
    <div className="pb-8">
      <TopBar label="Taraco App · Head of Production" />
      {children}
    </div>
  );
}
