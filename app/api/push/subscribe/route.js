import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// POST /api/push/subscribe — dipanggil dari PushNotificationSetup.jsx
// setelah pushManager.subscribe() berhasil. Upsert ke push_subscriptions
// milik user yang login (RLS membatasi ke profile_id = auth.uid(), jadi
// pakai client session biasa, bukan admin client).
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const subscription = await req.json();
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true });
}
