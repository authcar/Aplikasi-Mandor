import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { notifySupervisor, notifyMaster } from "@/lib/notify";
import { sendPush, sendPushToRoles } from "@/lib/push";

const TIPE_LABEL = {
  lembur: "Pengajuan Lembur",
  keuangan: "Pengajuan Reimburse",
  masalah: "Laporan Kurang Material",
};

const ALLOWED_TIPE = ["lembur", "keuangan", "masalah"];

// POST /api/notify — dipanggil dari form (client) setelah insert berhasil,
// buat kirim notifikasi Telegram. Gagal di sini TIDAK menandakan data gagal
// tersimpan — data sudah tersimpan sebelum ini dipanggil, jadi client sengaja
// tidak menampilkan error dari endpoint ini.
// body: { tipe: 'lembur'|'keuangan'|'masalah', proyek_id, ringkasan? }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const { tipe, proyek_id, ringkasan } = await req.json();
  if (!ALLOWED_TIPE.includes(tipe) || !proyek_id)
    return NextResponse.json({ ok: false }, { status: 400 });

  // Kalau pengajunya sendiri Supervisor (mis. laporan Kurang Material dari
  // Supervisor), tidak masuk akal notifikasi dikirim ke Supervisor proyek
  // itu (dirinya sendiri) — alihkan ke Master, sama seperti pola Kasbon.
  const pushPayload = {
    title: `${TIPE_LABEL[tipe]} baru`,
    body: `${profile.name}${ringkasan ? `: ${ringkasan}` : ""}`,
    url: "/",
  };

  let ok;
  if (profile.role === "SUPERVISOR") {
    ok = await notifyMaster({ tipe, namaPengaju: profile.name, ringkasan });
    await sendPushToRoles(["MASTER", "FINANCE"], pushPayload).catch(() => {});
  } else {
    ok = await notifySupervisor({ supabase, proyek_id, tipe, namaPengaju: profile.name, ringkasan });
    const { data: proyek } = await supabase
      .from("proyek")
      .select("supervisor_id")
      .eq("id", proyek_id)
      .maybeSingle();
    if (proyek?.supervisor_id) await sendPush(proyek.supervisor_id, pushPayload).catch(() => {});
  }

  return NextResponse.json({ ok });
}
