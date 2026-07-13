import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { notifySupervisor } from "@/lib/notify";

const ALLOWED_TIPE = ["lembur", "keuangan", "masalah"];

// POST /api/notify — dipanggil dari form (client) setelah insert berhasil,
// buat kirim notifikasi Telegram ke Supervisor proyek terkait. Gagal di sini
// TIDAK menandakan data gagal tersimpan — data sudah tersimpan sebelum ini
// dipanggil, jadi client sengaja tidak menampilkan error dari endpoint ini.
// body: { tipe: 'lembur'|'keuangan'|'masalah', proyek_id, ringkasan? }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const { tipe, proyek_id, ringkasan } = await req.json();
  if (!ALLOWED_TIPE.includes(tipe) || !proyek_id)
    return NextResponse.json({ ok: false }, { status: 400 });

  const ok = await notifySupervisor({
    supabase,
    proyek_id,
    tipe,
    namaPengaju: profile.name,
    ringkasan,
  });

  return NextResponse.json({ ok });
}
