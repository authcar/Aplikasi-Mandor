import webpush from "web-push";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Kirim web push ke satu/lebih akun (dicari lewat push_subscriptions,
// bisa lebih dari 1 device per akun). Sama seperti notifySupervisor/
// notifyMaster di lib/notify.js: tidak pernah melempar error ke caller,
// data utama sudah tersimpan sebelum ini dipanggil — push cuma pelengkap.
// Subscription yang sudah expired (410/404 dari push service) dihapus.
export async function sendPush(profileIds, { title, body, url = "/" }) {
  const ids = (Array.isArray(profileIds) ? profileIds : [profileIds]).filter(Boolean);
  if (!ids.length || !process.env.VAPID_PRIVATE_KEY) return false;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", ids);
  if (!subs?.length) return false;

  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        return true;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        return false;
      }
    })
  );
  return results.some(Boolean);
}

// Sama seperti notifyMaster (lib/notify.js) tapi buat push — cari semua
// akun dengan role tertentu (mis. ["MASTER", "FINANCE"]) lalu kirim ke
// subscription mereka.
export async function sendPushToRoles(roles, opts) {
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id").in("role", roles);
  if (!profiles?.length) return false;
  return sendPush(
    profiles.map((p) => p.id),
    opts
  );
}
