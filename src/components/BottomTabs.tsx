"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/plan", label: "My plan" },
  { href: "/run", label: "Record workout" },
];

// Kept in the brand blue the runner asked for.
export default function BottomTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 bg-[#0047AB] pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.4)]"
    >
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`block border-t-4 px-3 py-4 text-center font-athletic text-base font-semibold uppercase tracking-widest text-white ${
                  active ? "border-volt bg-white/15" : "border-transparent opacity-80 hover:bg-white/10"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
