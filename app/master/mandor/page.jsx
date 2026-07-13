import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import MandorManager from "@/components/MandorManager";

export const dynamic = "force-dynamic";

export default async function MandorMasterPage() {
  const { supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, name, phone")
    .eq("role", "MANDOR")
    .order("name");

  const mandors = (rows || []).map((r) => ({ id: r.id, name: r.name, phone: r.phone }));

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Mandor</h1>
        <p className="text-sm text-gray-500">Kelola akun login mandor</p>
      </header>

      <MandorManager initialMandors={mandors} />
    </main>
  );
}
