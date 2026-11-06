"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const IKON = "h-6 w-6";
const SVG = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: IKON };

// Staff: Home, Project Tracker (/portal, area terpisah dengan tampilannya
// sendiri), dan Profil.
const TABS = [
  {
    href: "/staff",
    label: "Home",
    icon: (
      <svg {...SVG}>
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    href: "/portal",
    label: "Tracker",
    icon: (
      <svg {...SVG}>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    href: "/staff/profil",
    label: "Profil",
    icon: (
      <svg {...SVG}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export default function StaffNavbar() {
  const pathname = usePathname();

  const isActive = (href) => (href === "/staff" ? pathname === "/staff" : pathname.startsWith(href));
  const idx = TABS.findIndex((tab) => isActive(tab.href));

  return (
    <nav className="tabbar" style={{ "--n": TABS.length, "--i": Math.max(idx, 0), "--on": idx >= 0 ? 1 : 0 }}>
      <span className="tabbar-pil" aria-hidden="true" />
      <div className="grid grid-cols-3 gap-1">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={`tabbar-item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
              {tab.icon}
              <span className="tabbar-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
