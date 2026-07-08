import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  const role = profile?.role;
  if (role === "SUPERVISOR") redirect("/supervisor");
  if (role === "MASTER") redirect("/master");
  if (role === "TUKANG_HARIAN") redirect("/tukang-harian");
  redirect("/mandor");
}
