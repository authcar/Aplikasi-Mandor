// Browser: unggah gambar kolom C hasil impor Excel (lihat pasangFoto di
// imporBoq.js) lalu kembalikan item siap simpan, dengan `foto` = path storage.
// Gambar dikecilkan dulu (PNG 1–2 MB -> ±100 KB) dan diunggah beberapa
// sekaligus. Foto yang gagal diunggah dilewati; item tetap diimpor dan jumlah
// yang gagal dilaporkan. onProgres(selesai, total) dipanggil tiap foto selesai.
import { kompresGambar } from "@/lib/gambar";

const SEKALIGUS = 4;

async function unggahSatu(proyekId, g) {
  const asli = new File([g.ambil()], `foto.${g.tipe === "image/png" ? "png" : "jpg"}`, { type: g.tipe });
  const kecil = await kompresGambar(asli, { sisiMaks: 1280, kualitas: 0.75 });
  const fd = new FormData();
  fd.append("proyek_id", proyekId);
  fd.append("foto", kecil);
  const r = await fetch("/api/portal/item-foto", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.path) throw new Error(j.error || "gagal");
  return j.path;
}

export async function unggahFotoItem(proyekId, items, onProgres) {
  const tugas = items.flatMap((it, i) => (it._gambar || []).map((g, k) => ({ i, k, g })));
  const path = items.map((it) => Array((it._gambar || []).length).fill(null));
  let gagal = 0, pesan = "", selesai = 0, urut = 0;

  async function pekerja() {
    while (urut < tugas.length) {
      const { i, k, g } = tugas[urut++];
      try {
        path[i][k] = await unggahSatu(proyekId, g);
      } catch (e) {
        gagal++;
        pesan ||= e.message;
      }
      onProgres?.(++selesai, tugas.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(SEKALIGUS, tugas.length) }, pekerja));

  return {
    items: items.map(({ _gambar, _baris, ...it }, i) => {
      const foto = path[i].filter(Boolean);
      return foto.length ? { ...it, foto } : it;
    }),
    gagal,
    pesan,
  };
}
