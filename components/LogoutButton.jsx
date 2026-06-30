"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

export default function LogoutButton() {
  const router = useRouter();
  const onClick = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 shadow-card transition active:bg-gray-100"
    >
      <Icon name="log-out" className="h-4 w-4" />
      Keluar
    </button>
  );
}
