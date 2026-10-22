import Lonceng from "./Lonceng";

// `kembali` = tautan ke aplikasi lapangan (hanya untuk staf; klien tidak punya akun).
// `notif` = daftar pemberitahuan untuk lonceng (hanya staf).
export default function Header({ kembali = false, label = "Project Tracker", notif = null }) {
  return (
    <header className="top">
      <div className="brand">
        <span className="logo" role="img" aria-label="Taraco Interior" />
        <small>{label}</small>
      </div>
      <div className="top-kanan">
        {notif && <Lonceng items={notif} />}
        {kembali && <a href="/" className="logout ikon-home" aria-label="Kembali ke aplikasi lapangan" title="Aplikasi lapangan">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
            </svg>
          </a>}
      </div>
    </header>
  );
}
