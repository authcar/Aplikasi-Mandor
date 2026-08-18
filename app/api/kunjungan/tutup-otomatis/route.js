import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { batasTutupOtomatis, sudahKedaluwarsa } from "@/lib/kunjunganAturan";

// POST /api/kunjungan/tutup-otomatis — dipanggil n8n tiap hari jam 17:00 WIB.
//
// Kunjungan yang diabsen masuk tapi tidak pernah diabsen keluar ditutup di
// jam potong dan ditandai TIDAK_SAH. Dua alasan kenapa ini perlu:
//   • rekapnya jujur — kunjungan tanpa absen keluar tidak punya durasi yang
//     bisa dipercaya, jadi tidak pantas dihitung sah;
//   • kalau dibiarkan menggantung, unique index idx_kunjungan_satu_berjalan
//     bikin supervisor tsb tidak bisa absen masuk di mana pun lagi.
//
// Jalur check-in di app/api/kunjungan juga menutup kunjungan basi milik orang
// yang sedang absen, jadi endpoint ini bukan satu-satunya penyelamat — kalau
// workflow n8n mati, sistemnya tetap pulih sendiri saat orangnya absen lagi.
//
// Autentikasi: header x-n8n-secret, pola sama dengan
// app/api/drive-sync/cleanup/route.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: terbuka, error } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .select("id, mulai_at")
    .eq("status", "BERJALAN");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Disaring di sini, bukan lewat query: batas potongnya bergantung pada
  // tanggal WIB tiap baris (dan digeser sehari untuk kunjungan yang dimulai
  // setelah jam 17:00), jadi tidak bisa dinyatakan sebagai satu perbandingan
  // timestamp di sisi database.
  const sekarang = new Date();
  const kedaluwarsa = (terbuka || []).filter((k) => sudahKedaluwarsa(k.mulai_at, sekarang));

  let ditutup = 0;
  for (const k of kedaluwarsa) {
    const { error: gagal } = await supabaseAdmin
      .from("kunjungan_supervisor")
      .update({
        selesai_at: batasTutupOtomatis(k.mulai_at).toISOString(),
        status: "TIDAK_SAH",
        catatan_sistem: "Tidak absen keluar — ditutup otomatis jam 17:00.",
      })
      .eq("id", k.id)
      .eq("status", "BERJALAN"); // jaga-jaga kalau orangnya absen keluar barusan
    if (!gagal) ditutup++;
  }

  return NextResponse.json({ ok: true, diperiksa: terbuka?.length || 0, ditutup });
}
