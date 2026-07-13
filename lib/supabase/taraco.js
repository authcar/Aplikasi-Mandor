import { createClient } from "@supabase/supabase-js";

// Client server-only ke project Supabase kedua (Taraco Project Management).
// Pakai service role key (bypass RLS) karena semua policy di sana mensyaratkan
// role "authenticated" milik user Taraco, yang tidak kita punya di sini.
// JANGAN pernah import file ini dari komponen client atau expose key-nya ke browser.
export function createTaracoClient() {
  return createClient(
    process.env.TARACO_SUPABASE_URL,
    process.env.TARACO_SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
