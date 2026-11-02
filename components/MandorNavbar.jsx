"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/mandor",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    href: "/mandor/profil",
    label: "Profil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export default function MandorNavbar() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/mandor") return pathname === "/mandor";
    return pathname.startsWith(href);
  };

  const idx = TABS.findIndex((tab) => isActive(tab.href));


  return (
    <nav className="tabbar" style={{ "--n": TABS.length, "--i": Math.max(idx, 0), "--on": idx >= 0 ? 1 : 0 }}>
      <span className="tabbar-pil" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-1">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tabbar-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {tab.icon}
              <span className="tabbar-label">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
