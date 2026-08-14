import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// Penerimaan (uang masuk dari klien) per proyek, dicatat Finance — dipakai
// buat hitung profit/loss proyek (penerimaan - total biaya_proyek).
// body: { proyek_id, nominal, keterangan?, tanggal? }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile || profile.role !== "FINANCE")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { proyek_id, nominal, keterangan, tanggal } = await req.json();
  const nilai = Number(nominal);
  if (!proyek_id || !Number.isFinite(nilai) || nilai <= 0)
    return NextResponse.json({ error: "Proyek dan nominal (>0) wajib diisi." }, { status: 400 });

  const { data, error } = await supabase
    .from("penerimaan_proyek")
    .insert({
      proyek_id,
      nominal: Math.round(nilai),
      keterangan: keterangan?.trim() || null,
      tanggal: tanggal || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
      created_by: profile.id,
    })
    .select("id, proyek_id, nominal, keterangan, tanggal")
    .single();

  if (error) return NextResponse.json({ error: "Gagal menyimpan penerimaan." }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE /api/penerimaan-proyek?id=...
export async function DELETE(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile || profile.role !== "FINANCE")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Param salah." }, { status: 400 });

  const { error } = await supabase.from("penerimaan_proyek").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus penerimaan." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
