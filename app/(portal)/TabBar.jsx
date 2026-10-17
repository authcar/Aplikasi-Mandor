"use client";

// Ikon garis 24x24 (stroke mengikuti warna teks).
const IKON = {
  progres: <path d="M3 20h18M6 20v-8M12 20V5M18 20v-5" />,
  rincian: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  bayar: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10.5h18M7 15h4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
  item: <path d="M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8M12 12v8" />,
  termin: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  klien: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  defect: <><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
};

// Navigasi antar bagian. Di HP menempel di bawah layar (mudah dijangkau jempol);
// di layar lebar jadi deretan tab biasa. `tabs` = [[kunci, label, angka?], ...];
// angka > 0 tampil sebagai lencana kecil (mis. jumlah defect baru).
export default function TabBar({ tabs, value, onChange }) {
  function pilih(k) {
    onChange(k);
    // Kalau sudah menggulir jauh, bawa awal isi tab ke bawah header.
    requestAnimationFrame(() => {
      const el = document.getElementById("isi-tab");
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
    });
  }

  return (
    <>
      <div id="isi-tab" className="anchor" />
      <nav className="tabbar" aria-label="Bagian halaman">
        {tabs.map(([k, label, n]) => (
          <button key={k} type="button" aria-pressed={value === k} onClick={() => pilih(k)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{IKON[k]}</svg>
            <span>{label}</span>
            {n > 0 && <i className="lencana" aria-label={`${n} baru`}>{n}</i>}
          </button>
        ))}
      </nav>
    </>
  );
}
