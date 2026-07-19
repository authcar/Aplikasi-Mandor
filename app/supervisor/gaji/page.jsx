import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PotonganCard from "@/components/PotonganCard";
import CalendarPotongan from "@/components/CalendarPotongan";
import GajiSupervisorHero from "@/components/GajiSupervisorHero";

export const dynamic = "force-dynamic";

// Rekap gaji gabungan: semua proyek supervisor, biaya minggu ini.
export default async function GajiSupervisorPage() {
  const { user, profile, supabase } = await getSessionProfile();

const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi")
    .eq("supervisor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Senin minggu ini
  const sum = (rows, f) => (rows || []).reduce((s, r) => s + Number(f(r)), 0);

  const chatId = profile.telegram_chat_id ? String(profile.telegram_chat_id) : null;

  const [{ data: potongan }, { data: checkin }, { data: kasbonRows }, { data: laporanBulanIni }] = await Promise.all([
    chatId
      ? supabase
          .from("potongan_gaji")
          .select("id, tanggal, persentase")
          .eq("chat_id", chatId)
          .gte("tanggal", iso(bulanIni))
          .order("tanggal")
      : Promise.resolve({ data: [] }),
    // checkin_harian: sumber lama (bot Telegram), tetap diambil & dikirim ke
    // CalendarPotongan sebagai fallback, tidak dipakai lagi untuk tampilan utama.
    chatId
      ? supabase
          .from("checkin_harian")
          .select("tanggal")
          .eq("chat_id", chatId)
          .gte("tanggal", iso(bulanIni))
      : Promise.resolve({ data: [] }),
    // Kasbon disetujui Master bulan ini — otomatis jadi potongan gaji.
    supabase
      .from("keuangan")
      .select("nominal")
      .eq("jenis", "KASBON")
      .eq("created_by", profile.id)
      .eq("status", "APPROVED")
      .gte("created_at", iso(bulanIni)),
    // Laporan harian manual milik supervisor ini, bulan berjalan — sumber
    // utama untuk kalender "Kalender Laporan Harian".
    supabase
      .from("laporan_harian")
      .select("tanggal")
      .eq("created_by", profile.id)
      .gte("tanggal", iso(bulanIni)),
  ]);

  const totalKasbon = sum(kasbonRows, (k) => k.nominal);

  // Potongan versi laporan manual: 0.5% per hari kerja (Senin-Sabtu) bulan ini
  // yang belum ada laporan_harian — menggantikan potongan_gaji (sistem lama,
  // berbasis bot Telegram) untuk hero gaji & kartu Performa di bawah. Data
  // potongan_gaji asli (variabel `potongan` & `checkin` di atas) tetap
  // dipakai untuk CalendarPotongan sebagai fallback, tidak dihapus.
  const wibTodayStr = today.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [wy, wm, wd] = wibTodayStr.split("-").map(Number);
  const laporanDatesSet = new Set((laporanBulanIni || []).map((r) => r.tanggal));
  const potonganManual = [];
  for (let i = 1; i <= wd; i++) {
    if (new Date(wy, wm - 1, i).getDay() === 0) continue; // Minggu libur
    const tgl = `${wy}-${String(wm).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    if (!laporanDatesSet.has(tgl)) {
      potonganManual.push({ id: tgl, tanggal: tgl, persentase: 0.5 });
    }
  }

  // Hitung rekap tiap proyek secara paralel.
  const rekap = await Promise.all(
    (proyek || []).map(async (p) => {
      const [{ data: abs }, { data: lbr }, { data: keu }] = await Promise.all([
        supabase
          .from("absensi")
          .select("upah_snap")
          .eq("proyek_id", p.id)
          .gte("tanggal", iso(monday)),
        supabase
          .from("lembur")
          .select("total")
          .eq("proyek_id", p.id)
          .eq("status", "APPROVED")
          .gte("tanggal", iso(monday)),
        supabase
          .from("keuangan")
          .select("nominal, jenis")
          .eq("proyek_id", p.id)
          .eq("status", "APPROVED")
          .gte("created_at", iso(monday)),
      ]);

      const upah = sum(abs, (a) => a.upah_snap);
      const lembur = sum(lbr, (l) => l.total);
      const reimburse = sum(
        (keu || []).filter((k) => k.jenis === "REIMBURSE"),
        (k) => k.nominal
      );
      return { ...p, upah, lembur, reimburse, total: upah + lembur + reimburse };
    })
  );

  const totalSemua = rekap.reduce((s, r) => s + r.total, 0);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <h1 className="text-xl font-bold tracking-tight">Rekap Gaji</h1>
      <p className="mb-4 text-sm text-gray-500">Biaya minggu ini · semua proyek</p>

      <GajiSupervisorHero
        gajiPokok={profile.gaji_pokok || 0}
        potongan={potonganManual}
        kasbon={totalKasbon}
      />

      {chatId ? (
        <>
          <h2 className="mt-6 mb-3 font-bold text-gray-700">Kalender Laporan Harian</h2>
          <CalendarPotongan
            chatId={chatId}
            initialPotongan={potongan || []}
            initialCheckin={checkin || []}
            initialLaporan={laporanBulanIni || []}
          />

          <h2 className="mt-5 mb-3 font-bold text-gray-700">Performa {profile.name}</h2>
          <PotonganCard rows={potonganManual} gajiPokok={profile.gaji_pokok || 0} kasbon={totalKasbon} />
        </>
      ) : (
        <div className="card mt-6 border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">
            Akun Anda belum terhubung ke bot Telegram, sehingga kalender laporan
            harian dan potongan belum bisa ditampilkan. Hubungi admin untuk
            menghubungkan akun Telegram Anda.
          </p>
        </div>
      )}

    </main>
  );
}
