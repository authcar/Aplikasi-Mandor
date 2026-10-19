import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST /api/push/subscribe — dipanggil dari PushNotificationSetup.jsx
// setelah pushManager.subscribe() berhasil. Upsert ke push_subscriptions
// atas nama user yang login. Memakai admin client (profile.id sudah
// diverifikasi dari sesi): endpoint itu unik per browser, jadi kalau browser
// yang sama pernah dipakai akun lain, baris lamanya milik profile lain dan
// upsert lewat RLS akan ditolak. Endpoint dipindahkan ke akun yang sekarang.
export async function POST(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const subscription = await req.json();
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("push/subscribe gagal:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
