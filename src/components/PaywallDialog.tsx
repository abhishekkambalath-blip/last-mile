"use client";

import { useEffect } from "react";
import { FREE_WEEKS, PRICE_INR } from "@/lib/plan";
import { setSubscribed } from "@/lib/subscription";

export const priceLabel = `₹${PRICE_INR.toLocaleString("en-IN")}`;

/**
 * The subscription prompt shown when a runner reaches a locked week.
 * Prototype: "Subscribe" only flips a flag in this browser. No payment is taken.
 */
export default function PaywallDialog({
  open,
  onClose,
  totalWeeks,
  raceDate,
}: {
  open: boolean;
  onClose: () => void;
  totalWeeks: number;
  raceDate: string;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  const race = new Date(`${raceDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="w-full max-w-sm space-y-5 rounded-3xl bg-elevated p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="paywall-title" className="text-2xl font-extrabold">
            Unlock your full plan
          </h2>
          <p className="mt-2 text-sm text-subtext">
            Your first {FREE_WEEKS} weeks are free. Weeks {FREE_WEEKS + 1} to {totalWeeks} take you to race day on {race}.
          </p>
        </div>

        <div className="rounded-2xl bg-carbon p-4">
          <div className="text-4xl font-extrabold">
            {priceLabel}
            <span className="text-base font-semibold text-subtext"> / year</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-subtext">
            <li>All {totalWeeks} weeks of your plan, from this week to race day</li>
            <li>Weekly distance, training phases and target paces for every week</li>
            <li>Recovery weeks and a taper before the race</li>
          </ul>
        </div>

        <p className="text-xs text-muted">Demo mode: no payment is taken in this prototype.</p>

        <div className="flex gap-3">
          <button type="button" autoFocus onClick={onClose} className="h-12 flex-1 rounded-full bg-carbon font-bold text-subtext hover:text-ink">
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              setSubscribed(true);
              onClose();
            }}
            className="h-12 flex-[1.4] rounded-full bg-volt font-bold text-void hover:brightness-110"
          >
            Subscribe · {priceLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
