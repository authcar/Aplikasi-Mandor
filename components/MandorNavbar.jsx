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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="grid grid-cols-2">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${
                active ? "text-brand" : "text-gray-400 active:text-gray-600"
              }`}
            >
              {tab.icon}
              <span className={`text-[10px] font-semibold ${active ? "text-brand" : "text-gray-400"}`}>
                {tab.label}
              </span>
              {active && <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
