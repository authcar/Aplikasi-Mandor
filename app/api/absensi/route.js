import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proyek_id, tanggal, jumlah_hadir = 0 } = await req.json();
  if (!proyek_id) return NextResponse.json({ error: "proyek_id wajib" }, { status: 400 });
  const tgl = tanggal || new Date().toISOString().slice(0, 10);

  // Cek apakah sudah ada record hari ini
  const { data: existing } = await supabase
    .from("absensi_ringkas")
    .select("id")
    .eq("proyek_id", proyek_id)
    .eq("tanggal", tgl)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase
      .from("absensi_ringkas")
      .update({ jumlah_hadir, created_by: profile.id })
      .eq("id", existing.id));
  } else {
    ({ error } = await supabase
      .from("absensi_ringkas")
      .insert({ proyek_id, tanggal: tgl, jumlah_hadir, created_by: profile.id }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, total_hadir: jumlah_hadir });
}
