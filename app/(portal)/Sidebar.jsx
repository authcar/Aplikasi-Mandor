"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ikon = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IKON = {
  proyek: ikon(<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" />),
  bobot: ikon(<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>),
  aplikasi: ikon(<path d="M10 6l-6 6 6 6M4 12h16" />),
};

// Menu samping kaca, hanya tampil di layar lebar (di HP navigasi ada di tab bawah
// dan header). Item aktif berwarna gelap; angka = jumlah proyek aktif.
export default function Sidebar({ admin, nama, peran, jumlah }) {
  const path = usePathname();
  const item = (href, label, ik, aktif, angka) => (
    <Link key={href} href={href} className={`sb-item${aktif ? " aktif" : ""}`} aria-current={aktif ? "page" : undefined}>
      {ik}<span>{label}</span>{angka > 0 && <i>{angka}</i>}
    </Link>
  );
  return (
    <aside className="sidebar" aria-label="Menu">
      <div className="sb-who">
        <b>{nama}</b>
        <span className="small">{peran}</span>
      </div>
      <nav>
        {item("/portal", "Proyek", IKON.proyek, path === "/portal" || path.startsWith("/portal/proyek"), jumlah)}
        {admin && item("/portal/bobot", "Bobot tahap", IKON.bobot, path.startsWith("/portal/bobot"))}
      </nav>
      <div className="sb-bawah">
        {item("/", "Aplikasi lapangan", IKON.aplikasi, false)}
      </div>
    </aside>
  );
}
