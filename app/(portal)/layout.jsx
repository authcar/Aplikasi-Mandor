import { Archivo, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./portal.css";

// Root layout KEDUA, khusus Portal Klien (/portal untuk staf, /k/[token] untuk
// klien). Tampilannya beda total dari aplikasi lapangan (app/(mandor)/layout.jsx):
// CSS sendiri tanpa Tailwind dan tidak dikurung lebar HP, karena klien juga
// membukanya dari laptop. Nama kelas di portal.css (.card, .btn) bentrok dengan
// globals.css, jadi kedua file itu tidak boleh dimuat bersamaan.

const display = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono" });

export const metadata = {
  title: "Taraco · Project Tracker",
  description: "Pantau progres proyek interior Anda",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#3A281C" };

export default function PortalLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {children}
        <div className="foot">© {new Date().getFullYear()} Taraco Interior · Design meet function</div>
      </body>
    </html>
  );
}
