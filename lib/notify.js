import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TIPE_LABEL = {
  lembur: "Pengajuan Lembur",
  keuangan: "Pengajuan Reimburse",
  masalah: "Laporan Kurang Material",
  kasbon: "Pengajuan Kasbon",
};

async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Kirim notifikasi Telegram ke Supervisor pemilik proyek saat ada pengajuan
// baru. Sengaja tidak pernah melempar error — data utama (lembur/keuangan/
// masalah) sudah tersimpan duluan sebelum ini dipanggil, notifikasi cuma
// pelengkap. Kalau TELEGRAM_BOT_TOKEN belum di-set atau Supervisor belum
// pernah /start bot-nya (telegram_chat_id kosong), fungsi ini diam-diam
// no-op dan mengembalikan false.
export async function notifySupervisor({ supabase, proyek_id, tipe, namaPengaju, ringkasan }) {
  const label = TIPE_LABEL[tipe];
  if (!label || !proyek_id) return false;

  const { data: proyek } = await supabase
    .from("proyek")
    .select("nama, supervisor_id")
    .eq("id", proyek_id)
    .maybeSingle();
  if (!proyek?.supervisor_id) return false;

  const { data: supervisor } = await supabaseAdmin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", proyek.supervisor_id)
    .maybeSingle();
  if (!supervisor?.telegram_chat_id) return false;

  const text =
    `🔔 <b>${label} baru</b>\n` +
    `Proyek: ${proyek.nama}\n` +
    `Dari: ${namaPengaju}` +
    (ringkasan ? `\n${ringkasan}` : "") +
    `\n\nBuka aplikasi untuk detail &amp; persetujuan.`;

  return sendTelegram(String(supervisor.telegram_chat_id), text);
}

// Kirim notifikasi Telegram ke SEMUA akun MASTER — dipakai utk pengajuan
// yang perlu disetujui Master langsung (bukan Supervisor), mis. kasbon
// yang diajukan Supervisor sendiri. Sama seperti notifySupervisor: tidak
// pernah melempar error, no-op diam-diam kalau bot token/chat_id kosong.
export async function notifyMaster({ tipe, namaPengaju, ringkasan }) {
  const label = TIPE_LABEL[tipe];
  if (!label) return false;

  const { data: masters } = await supabaseAdmin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("role", "MASTER")
    .not("telegram_chat_id", "is", null);
  if (!masters?.length) return false;

  const text =
    `🔔 <b>${label} baru</b>\n` +
    `Dari: ${namaPengaju}` +
    (ringkasan ? `\n${ringkasan}` : "") +
    `\n\nBuka aplikasi untuk detail &amp; persetujuan.`;

  const results = await Promise.all(
    masters.map((m) => sendTelegram(String(m.telegram_chat_id), text))
  );
  return results.some(Boolean);
}
