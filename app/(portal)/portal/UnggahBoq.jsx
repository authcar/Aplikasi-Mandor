"use client";
import { useState } from "react";
import { bukaXlsx } from "@/lib/portal/bacaXlsx";

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Pilih file BoQ (.xlsx), lalu sheet proyeknya. File dibaca di browser dan
// tidak dikirim ke server. `petunjuk` = nama/kode proyek untuk menebak sheet.
// onPilih({ sheet, rows }) tiap sheet dipilih; onPilih(null) kalau batal.
export default function UnggahBoq({ petunjuk = [], onPilih }) {
  const [buku, setBuku] = useState(null);
  const [sheet, setSheet] = useState("");
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);

  function pilihSheet(b, s) {
    setSheet(s);
    onPilih(s ? { sheet: s, rows: b.baca(s) } : null);
  }

  async function pilihFile(e) {
    const file = e.target.files?.[0];
    setGalat("");
    setBuku(null);
    setSheet("");
    onPilih(null);
    if (!file) return;
    setMemuat(true);
    try {
      const b = bukaXlsx(await file.arrayBuffer());
      if (!b.sheets.length) throw new Error();
      setBuku(b);
      const kunci = petunjuk.map(norm).filter((k) => k.length >= 3);
      const cocok = b.sheets.length === 1 ? b.sheets[0] : b.sheets.find((s) => kunci.some((k) => norm(s).includes(k)));
      pilihSheet(b, cocok || "");
    } catch {
      setGalat("File tidak bisa dibaca. Pastikan formatnya Excel .xlsx (bukan .xls atau PDF).");
    }
    setMemuat(false);
  }

  return (
    <>
      <label className="lbl">
        File BoQ (.xlsx)
        <input className="inp" type="file" style={{ padding: "9px 12px" }} onChange={pilihFile}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </label>
      {memuat && <p className="small" style={{ margin: 0 }}>Membaca file…</p>}
      {galat && <p className="note b-bad">{galat}</p>}
      {buku && buku.sheets.length > 1 && (
        <label className="lbl">
          Sheet proyek ({buku.sheets.length} sheet)
          <select className="inp" value={sheet} onChange={(e) => pilihSheet(buku, e.target.value)}>
            <option value="">— Pilih sheet —</option>
            {buku.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
    </>
  );
}
