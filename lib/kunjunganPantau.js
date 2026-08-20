// Operasi tabel kunjungan_pantau yang dipakai lebih dari satu route.
//
// Semuanya memakai service role, sama seperti lib/notify.js: tabel pantauan
// sengaja select-only untuk user biasa (lihat supabase/add_kunjungan_pantau.sql),
// jadi tidak ada jalan menulisnya lewat sesi login.
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Spot-check yang masih menggantung saat kunjungan diabsen keluar dijawab
// oleh absen keluar itu sendiri, bukan dihitung terlewat.
//
// Orangnya baru saja mengirim posisi — menghukum dia karena tidak menjawab
// push yang datang tiga menit sebelum dia menekan tombol keluar akan terbaca
// sebagai bug, dan memang tidak adil. Posisi absen keluarnya dipakai apa
// adanya sebagai jawaban.
// Mengembalikan id baris yang terisi, supaya pemanggilnya bisa mengeluarkan
// baris itu dari hitungan pelanggaran — lihat hitungPelanggaran.
export async function jawabSpotcheckTerbuka(kunjunganId, { lat, lng, akurasi, jarak, hasil }) {
  const { data } = await supabaseAdmin
    .from("kunjungan_pantau")
    .update({ waktu: new Date().toISOString(), lat, lng, akurasi, jarak, hasil })
    .eq("kunjungan_id", kunjunganId)
    .eq("jenis", "SPOTCHECK")
    .is("hasil", null)
    .select("id");

  return (data || []).map((b) => b.id);
}

// Spot-check menggantung pada kunjungan yang ditutup paksa jam 17:00. Di sini
// TIDAK ada posisi apa pun yang bisa dipakai — orangnya tidak pernah absen
// keluar — jadi memang terlewat.
export async function lewatkanSpotcheckTerbuka(kunjunganId) {
  await supabaseAdmin
    .from("kunjungan_pantau")
    .update({ hasil: "TIDAK_DIJAWAB" })
    .eq("kunjungan_id", kunjunganId)
    .eq("jenis", "SPOTCHECK")
    .is("hasil", null);
}

// Rekap pelanggaran satu kunjungan, untuk dinilai nilaiKunjungan().
//
// Baris DI_LUAR dan baris TIDAK_DIJAWAB dihitung terpisah — lihat alasannya di
// lib/kunjunganAturan.js. Baris yang masih menggantung (hasil null) tidak
// dihitung apa pun: statusnya memang belum diketahui, dan menebaknya ke salah
// satu arah sama-sama salah.
//
// `kecuali` menampung baris yang SUDAH dinilai lewat jalur lain, dan tanpa itu
// satu pembacaan GPS bisa muncul dua kali sebagai pelanggaran berbeda. Kasus
// nyatanya: absen keluar dari luar radius sekaligus menjawab spot-check yang
// menggantung, lalu catatannya berbunyi "Absen keluar dari 620m di luar radius
// 500m. Terdeteksi 1× di luar radius saat kunjungan berlangsung." — dua
// kalimat untuk satu kejadian yang sama, terbaca seolah orangnya melanggar
// dua kali.
export async function hitungPelanggaran(kunjunganId, kecuali = []) {
  const { data } = await supabaseAdmin
    .from("kunjungan_pantau")
    .select("id, jenis, hasil")
    .eq("kunjungan_id", kunjunganId)
    .not("hasil", "is", null);

  const baris = (data || []).filter((b) => !kecuali.includes(b.id));
  return {
    pantauDiLuar: baris.filter((b) => b.hasil === "DI_LUAR").length,
    spotcheckTerlewat: baris.filter((b) => b.hasil === "TIDAK_DIJAWAB").length,
  };
}
