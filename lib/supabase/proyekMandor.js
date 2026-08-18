// Daftar proyek aktif yang dipegang seorang MANDOR.
//
// Sejak Taraco mengizinkan 1 proyek dipegang >1 mandor (projects.mandors,
// jsonb array — lihat lib/supabase/syncProyek.js), kolom tunggal
// proyek.mandor_id cuma menyimpan mandor PERTAMA di array. Daftar lengkapnya
// ada di tabel proyek_mandor (supabase/add_proyek_mandor.sql). Filter lama
// `.eq("mandor_id", profile.id)` bikin mandor ke-2 dst tidak pernah melihat
// proyeknya sama sekali — makanya semua halaman /mandor sekarang lewat sini.
//
// Tetap meng-OR-kan mandor_id supaya proyek lokal yang dibuat manual di
// Aplikasi Mandor (taraco_id null, tidak pernah disentuh sync sehingga tidak
// punya baris proyek_mandor) ikut tampil seperti sebelumnya.
//
// Catatan: RLS `proyek_read`/`my_proyek_ids()` juga harus mengenal
// proyek_mandor, kalau tidak baris proyek mandor ke-2 tetap disaring Postgres
// walau query di sini sudah benar — lihat supabase/fix_proyek_mandor_akses.sql.
export async function getProyekMandor(supabase, mandorId, kolom = "id, nama") {
  const { data: pasangan } = await supabase
    .from("proyek_mandor")
    .select("proyek_id")
    .eq("mandor_id", mandorId);

  const ids = [...new Set((pasangan || []).map((r) => r.proyek_id))];

  let q = supabase.from("proyek").select(kolom).eq("is_active", true).order("nama");
  q = ids.length
    ? q.or(`mandor_id.eq.${mandorId},id.in.(${ids.join(",")})`)
    : q.eq("mandor_id", mandorId);

  const { data } = await q;
  return data || [];
}
