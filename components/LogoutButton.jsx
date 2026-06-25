"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const onClick = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };
  return (
    <button onClick={onClick} className="text-sm font-medium text-gray-500">
      Keluar
    </button>
  );
}
