import { redirect } from "next/navigation";
import { ambilStaf } from "@/lib/portal/server";
import Header from "../Header";

export const dynamic = "force-dynamic";

// Area staf portal (MASTER/FINANCE = admin, SUPERVISOR, MANDOR = tukang). Role lain dikembalikan ke
// berandanya sendiri (middleware.js sudah menyaring; ini lapis kedua).
export default async function StafLayout({ children }) {
  const { staf } = await ambilStaf();
  if (!staf) redirect("/");
  return (
    <>
      <Header kembali label={`Project Tracker · ${staf.nama}`} />
      {children}
    </>
  );
}
