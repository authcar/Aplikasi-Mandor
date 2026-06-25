import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";

export default async function Home() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  redirect(profile?.role === "SUPERVISOR" ? "/supervisor" : "/mandor");
}
