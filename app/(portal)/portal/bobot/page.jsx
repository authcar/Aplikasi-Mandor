import { redirect } from "next/navigation";
import { ambilStaf } from "@/lib/portal/server";
import { ambilBobotTahap } from "@/lib/portal/data";
import BobotTahap from "./BobotTahap";

export default async function BobotPage() {
  const { staf } = await ambilStaf();
  if (staf.role !== "ADMIN") redirect("/portal");
  return <BobotTahap tersimpan={await ambilBobotTahap()} />;
}
