import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// DELETE /api/proyek/titik — Master menghapus titik acuan GPS sebuah proyek
// supaya bisa di-set ulang.
//
// Titik proyek ditetapkan otomatis dari posisi Supervisor yang pertama kali
// absen masuk di sana (lihat app/api/kunjungan/route.js). Kalau orang pertama
// itu ternyata absen dari luar lokasi, titiknya melenceng dan SEMUA orang
// setelahnya ikut ditolak — jadi harus ada jalan membatalkannya. Setelah
// direset, absen masuk berikutnya akan menetapkan titik baru.
//
// body: { id }
// Pakai client ber-session (bukan service-role) supaya tunduk RLS
// proyek_write — pola sama dengan app/api/proyek/route.js.
export async function DELETE(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "MASTER")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const { error } = await supabase
    .from("proyek")
    .update({ lat: null, lng: null, titik_diset_oleh: null, titik_diset_at: null })
    .eq("id", id);

  if (error)
    return NextResponse.json(
      { error: "Gagal menghapus titik. Proyek tidak ditemukan atau tidak diizinkan." },
      { status: 400 }
    );

  return NextResponse.json({ ok: true });
}
