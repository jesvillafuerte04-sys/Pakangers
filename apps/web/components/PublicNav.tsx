"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  matches: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  standings: "M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z",
  bracket: "M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z",
  profile: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
} as const;

export function PublicNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/t/${slug}`;
  const items = [
    { href: base, label: "Now", icon: "home" as const },
    { href: `${base}/matches`, label: "Matches", icon: "matches" as const },
    { href: `${base}/standings`, label: "Standings", icon: "standings" as const },
    { href: `${base}/bracket`, label: "Bracket", icon: "bracket" as const },
    { href: `${base}/info`, label: "Info", icon: "profile" as const },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 bg-[var(--color-navy)] shadow-[0_-4px_16px_rgba(27,41,75,0.15)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl justify-around px-2 pb-3 pt-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1 text-xs font-semibold transition-colors"
              style={{ color: active ? "var(--color-gold)" : "#7481A0" }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d={ICONS[item.icon]} />
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
