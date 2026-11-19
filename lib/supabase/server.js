import { cache } from "react";
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
// cache(): layout dan page dalam satu permintaan memakai hasil yang sama (hemat dua kali bolak-balik ke Supabase).
export const getSessionProfile = cache(async () => {
  const supabase = createClient();
  // Id dari cookie (lokal) dipakai untuk membaca profil berbarengan dengan getUser() yang
  // memverifikasi token ke server auth: satu bolak-balik, bukan dua berurutan.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { user: null, profile: null, supabase };
  const [{ data: { user } }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("id, name, role, gaji_pokok, telegram_chat_id, proyek_id")
      .eq("id", session.user.id)
      .single(),
  ]);
  if (!user || user.id !== session.user.id) return { user: null, profile: null, supabase };
  return { user, profile, supabase };
});
