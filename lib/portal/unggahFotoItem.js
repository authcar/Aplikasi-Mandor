// Browser: unggah gambar kolom C hasil impor Excel (lihat pasangFoto di
// imporBoq.js) lalu kembalikan item siap simpan, dengan `foto` = path storage.
// Gambar dikecilkan dulu (PNG 1–2 MB -> ±100 KB). Foto yang gagal diunggah
// dilewati; item tetap diimpor dan jumlah yang gagal dilaporkan.
import { kompresGambar } from "@/lib/gambar";

export async function unggahFotoItem(proyekId, items) {
  let gagal = 0, pesan = "";
  const hasil = [];
  for (const { _gambar, _baris, ...i } of items) {
    const foto = [];
    for (const g of _gambar || []) {
      try {
        const asli = new File([g.ambil()], `foto.${g.tipe === "image/png" ? "png" : "jpg"}`, { type: g.tipe });
        const kecil = await kompresGambar(asli, { sisiMaks: 1280, kualitas: 0.75 });
        const fd = new FormData();
        fd.append("proyek_id", proyekId);
        fd.append("foto", kecil);
        const r = await fetch("/api/portal/item-foto", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.path) throw new Error(j.error || "gagal");
        foto.push(j.path);
      } catch (e) {
        gagal++;
        pesan ||= e.message;
      }
    }
    hasil.push(foto.length ? { ...i, foto } : i);
  }
  return { items: hasil, gagal, pesan };
}
