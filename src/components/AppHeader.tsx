"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RunnerIcon from "@/components/RunnerIcon";
import { useAccount } from "@/lib/account";
import { signOut, useAuth } from "@/lib/auth";
import { writeSaved } from "@/lib/store";
import { useSubscribed } from "@/lib/subscription";

/** The top bar, with a profile menu on the left: Profile, Subscription and Start new plan. */
export default function AppHeader() {
  const router = useRouter();
  const path = usePathname();
  const account = useAccount();
  const auth = useAuth();
  const subscribed = useSubscribed();
  const initial = account.name.trim().charAt(0).toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // Close the menu on a click outside it, and close the menu or dialog on Escape.
  useEffect(() => {
    if (!menuOpen && !confirming) return;
    const away = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && setMenuOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setConfirming(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen, confirming]);

  function startNewPlan() {
    // Clears the plan and the form answers. Recorded runs are kept.
    writeSaved(null);
    setConfirming(false);
    setMenuOpen(false);
    router.push("/plan"); // with no plan saved, the Plan tab shows the plan form
  }

  // The profile, subscription and devices pages have their own top bar.
  // The sign-in pages, and every page while nobody is signed in, have no app header either.
  const authPage = ["/signin", "/signup", "/verify", "/forgot", "/reset"].includes(path);
  if (path === "/profile" || path === "/subscribe" || path === "/devices" || authPage || auth.status === "loading" || auth.status === "out") return null;

  const itemCls = "flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-white/5";
  const iconCls = "h-5 w-5 text-subtext";
  const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

  return (
    <>
      <header className="sticky top-0 z-30 bg-elevated pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="relative" ref={menu}>
            <button
              type="button"
              aria-label="Profile menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white ring-offset-2 ring-offset-elevated transition hover:brightness-125 focus-visible:ring-2 focus-visible:ring-white"
            >
              {initial ? <span className="text-lg font-bold">{initial}</span> : <RunnerIcon className="h-5 w-5" />}
            </button>
            {menuOpen && (
              <div role="menu" className="absolute left-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-[#1d2129] shadow-xl shadow-black/50">
                <Link role="menuitem" href="/profile" onClick={() => setMenuOpen(false)} className={itemCls}>
                  <svg {...svg} className={iconCls}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  <span className="flex-1">{account.name.trim() || "Profile"}</span>
                </Link>
                <Link role="menuitem" href="/subscribe" onClick={() => setMenuOpen(false)} className={itemCls}>
                  <svg {...svg} className={iconCls}>
                    <path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" />
                  </svg>
                  <span className="flex-1">Subscription</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${subscribed ? "bg-[#2ac4bd] text-void" : "bg-white/10 text-subtext"}`}>{subscribed ? "ACTIVE" : "FREE"}</span>
                </Link>
                <Link role="menuitem" href="/devices" onClick={() => setMenuOpen(false)} className={itemCls}>
                  <svg {...svg} className={iconCls}>
                    <rect x="7" y="2" width="10" height="20" rx="3" />
                    <path d="M10 6h4M12 18h.01" />
                  </svg>
                  <span className="flex-1">Connect devices</span>
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirming(true);
                  }}
                  className={`${itemCls} border-t border-line`}
                >
                  <svg {...svg} className={iconCls}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Start new plan
                </button>
                {auth.status === "in" && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      router.replace("/signin");
                    }}
                    className={`${itemCls} border-t border-line`}
                  >
                    <svg {...svg} className={iconCls}>
                      <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
                    </svg>
                    <span className="flex min-w-0 flex-col">
                      <span>Sign out</span>
                      <span className="truncate text-xs font-normal text-muted">{auth.email}</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <Link href="/today" className="text-xl font-extrabold tracking-tight text-ink">
            Last Mile
          </Link>

          {/* Keeps the wordmark centred. */}
          <span className="w-11" aria-hidden="true" />
        </div>
      </header>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setConfirming(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-plan-title"
            className="w-full max-w-sm space-y-4 rounded-3xl bg-elevated p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-plan-title" className="text-xl font-extrabold">
              Start a new plan?
            </h2>
            <p className="text-sm text-subtext">This clears your current plan and answers. Your recorded runs are kept.</p>
            <div className="flex gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirming(false)}
                className="h-12 flex-1 rounded-full bg-carbon font-bold text-subtext hover:text-ink"
              >
                Cancel
              </button>
              <button type="button" onClick={startNewPlan} className="h-12 flex-1 rounded-full bg-volt font-bold text-void hover:brightness-110">
                Start new plan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
