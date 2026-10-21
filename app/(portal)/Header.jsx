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
        {kembali && <a href="/" className="logout">← Aplikasi</a>}
      </div>
    </header>
  );
}
