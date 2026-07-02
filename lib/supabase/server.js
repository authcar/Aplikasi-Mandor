import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client server-side yang menghormati session + RLS user.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Helper: ambil user + profile (role) sekali jalan.
export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role, gaji_pokok, telegram_chat_id")
    .eq("id", user.id)
    .single();
  return { user, profile, supabase };
}
