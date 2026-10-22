"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const TABS = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...icon}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...icon}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
      </svg>
    ),
  },
  {
    href: "/run",
    label: "Record",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" {...icon}>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.5l5 3.5-5 3.5z" />
      </svg>
    ),
  },
];

/** Fixed bottom navigation, with a "Record workout" shortcut above it on the Today and Plan screens. */
export default function BottomTabs({ showRecord = true }: { showRecord?: boolean }) {
  const path = usePathname();
  return (
    <>
      {showRecord && path !== "/run" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3">
          <Link
            href="/run"
            className="pointer-events-auto mx-auto flex h-14 max-w-3xl items-center justify-center gap-3 rounded-full bg-volt text-lg font-bold text-void shadow-lg shadow-black/40 transition active:scale-[0.99]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l12-7.5z" />
            </svg>
            Record workout
          </Link>
        </div>
      )}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#0f1116] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex h-16 max-w-3xl">
          {TABS.map((t) => {
            const active = path === t.href;
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                    active ? "text-ink" : "text-muted hover:text-subtext"
                  }`}
                >
                  {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-teal" />}
                  {t.icon}
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
