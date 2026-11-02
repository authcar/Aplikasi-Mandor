import { Poppins } from "next/font/google";
import "./globals.css";

// Poppins di seluruh aplikasi — sama dengan Taraco Project Tracker.
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-poppins", display: "swap" });

export const metadata = {
  title: "Taraco App",
  description: "Manajemen proyek lapangan untuk Mandor & Supervisor",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Taraco",
  },
  icons: {
    // `icon` WAJIB disebut di sini: begitu metadata.icons diisi, Next berhenti
    // memakai konvensi file app/icon.svg, jadi tanpa baris ini tab browser
    // tidak dapat <link rel="icon"> sama sekali (dan /favicon.ico 404).
    // favicon.png = logo Taraco yang sama persis dengan yang dipakai
    // Taraco-Project-Management (index.html: rel="icon" -> /favicon.png).
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1F1D1D",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body>
        {/* Transparan di HP supaya gradasi kaca + cakram melayang dari globals.css terlihat. */}
        <div className="app-frame relative mx-auto min-h-screen max-w-md">
          {children}
        </div>
      </body>
    </html>
  );
}
