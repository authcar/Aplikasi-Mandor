import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// POST /api/absensi  — Bulk insert roll-call dalam 1 klik.
// body: { proyek_id, tanggal?, hadir_ids: [tukang_id...] }
// Memakai upsert agar mandor bisa koreksi absen di hari yg sama (unique tukang+tanggal).
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proyek_id, tanggal, hadir_ids = [] } = await req.json();
  if (!proyek_id) return NextResponse.json({ error: "proyek_id wajib" }, { status: 400 });
  const tgl = tanggal || new Date().toISOString().slice(0, 10);

  // Ambil daftar tukang aktif proyek (RLS memastikan hanya proyek milik mandor)
  const { data: tukangs, error: e1 } = await supabase
    .from("tukang")
    .select("id, upah_harian")
    .eq("proyek_id", proyek_id)
    .eq("is_active", true);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  const hadirSet = new Set(hadir_ids);
  const rows = tukangs.map((t) => ({
    proyek_id,
    tukang_id: t.id,
    tanggal: tgl,
    hadir: hadirSet.has(t.id),
    upah_snap: hadirSet.has(t.id) ? t.upah_harian : 0,
    created_by: profile.id,
  }));

  const { data, error } = await supabase
    .from("absensi")
    .upsert(rows, { onConflict: "tukang_id,tanggal" })
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const total_hadir = rows.filter((r) => r.hadir).length;
  const total_upah = rows.reduce((s, r) => s + Number(r.upah_snap), 0);
  return NextResponse.json({ ok: true, total_hadir, total_upah, count: data.length });
}
