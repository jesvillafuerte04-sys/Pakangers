"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/t/${slug}`;
  const items = [
    { href: base, label: "Now" },
    { href: `${base}/matches`, label: "Matches" },
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/bracket`, label: "Bracket" },
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${
              active
                ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-gold)]"
                : "border-[var(--color-navy)] text-[var(--color-navy)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
