"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firstName, useAccount } from "@/lib/account";
import { FREE_WEEKS, PRICE_INR } from "@/lib/plan";
import { useSaved } from "@/lib/store";
import { setSubscribed, useSubscribed } from "@/lib/subscription";

const TEAL = "#2ac4bd";

const BENEFITS = [
  "Every week of your plan, from today to race day, with long runs, tempo runs and intervals built for your goal",
  "Recovery weeks and a taper, so you arrive at the start line fresh",
  "Change your race, pace or level at any time and we rebuild your plan",
];

const check = (
  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: TEAL, color: TEAL }} aria-hidden="true">
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  </span>
);

const price = `₹${PRICE_INR.toLocaleString("en-IN")}`;
const perWeek = `₹${(PRICE_INR / 52).toFixed(2)}`;

/** A plan you can pick: a selectable card with a title, the price and a short line. */
function PlanCard({ selected, onSelect, title, price: p, sub, badge }: { selected: boolean; onSelect: () => void; title: string; price: string; sub: string; badge?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative w-full rounded-2xl border-2 bg-elevated p-4 text-left transition ${selected ? "" : "border-line opacity-80 hover:opacity-100"}`}
      style={selected ? { borderColor: TEAL } : undefined}
    >
      {badge && (
        <span className="absolute -top-3 right-4 rounded-full px-3 py-1 text-xs font-extrabold text-void" style={{ background: TEAL }}>
          {badge}
        </span>
      )}
      <div className="text-lg font-extrabold">{title}</div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-subtext">
        <span>{p}</span>
        <span className="text-sm">{sub}</span>
      </div>
    </button>
  );
}

export default function SubscribePage() {
  const router = useRouter();
  const account = useAccount();
  const { saved } = useSaved();
  const subscribed = useSubscribed();
  const [choice, setChoice] = useState<"free" | "annual">("annual");
  const name = firstName(account);
  const weeks = saved?.plan?.weeks.length;

  const [failed, setFailed] = useState(false);
  async function act(on: boolean) {
    setFailed(false);
    if (!(await setSubscribed(on))) setFailed(true);
  }

  const close = () => (window.history.length > 1 ? router.back() : router.push("/today"));

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4">
        <div className="flex justify-end">
          <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex justify-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/80 text-white" style={{ background: "linear-gradient(135deg,#1b2b2a,#4a3a36)" }} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" />
              <path d="M5 21h14" />
            </svg>
          </span>
        </div>

        {subscribed ? (
          <>
            <h1 className="mt-8 text-center text-3xl font-extrabold leading-tight">You&apos;re subscribed</h1>
            <p className="mt-2 text-center text-lg text-subtext">{name ? `${name}, your` : "Your"} full plan is unlocked{weeks ? `, all ${weeks} weeks` : ""}.</p>

            <div className="mt-8 rounded-2xl border-2 bg-elevated p-4" style={{ borderColor: TEAL }}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold">Annual</span>
                <span className="rounded-full px-3 py-1 text-xs font-extrabold text-void" style={{ background: TEAL }}>
                  ACTIVE
                </span>
              </div>
              <div className="mt-1 text-subtext">
                {price}/year · {perWeek}/week
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted">Demo mode: no payment was taken in this prototype.</p>
            {failed && (
              <p role="alert" className="mt-2 text-center text-sm text-vo2">
                We could not save that. Try again.
              </p>
            )}

            <div className="mt-auto sticky bottom-0 -mx-5 bg-void px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3 pt-4">
              <Link href="/plan" className="flex h-14 w-full items-center justify-center rounded-full text-lg font-bold text-void" style={{ background: TEAL }}>
                Back to my plan
              </Link>
              <button type="button" onClick={() => void act(false)} className="h-11 w-full text-sm font-bold text-subtext hover:text-ink">
                Cancel subscription
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-center text-3xl font-extrabold leading-tight">Unlock your personalized training plan</h1>
            <p className="mt-2 text-center text-lg text-subtext">{name ? `${name}, get started today` : "Get started today"}</p>

            <ul className="mt-8 space-y-4">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-3 text-[15px] leading-snug">
                  {check}
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div role="radiogroup" aria-label="Choose a plan" className="mt-8 space-y-4">
              <PlanCard selected={choice === "annual"} onSelect={() => setChoice("annual")} title="Annual" price={`${price}/year`} sub={`${perWeek}/week`} badge="FULL PLAN" />
              <PlanCard selected={choice === "free"} onSelect={() => setChoice("free")} title="Free" price="₹0" sub={`First ${FREE_WEEKS} weeks only`} />
            </div>

            <div className="mt-auto sticky bottom-0 -mx-5 bg-void px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <button
                type="button"
                onClick={() => {
                  if (choice === "annual") void act(true);
                  else close();
                }}
                className="flex h-14 w-full items-center justify-center rounded-full text-lg font-bold text-void transition active:scale-[0.99]"
                style={{ background: TEAL }}
              >
                {choice === "annual" ? "Start now" : "Stay on the free plan"}
              </button>
              {failed && (
              <p role="alert" className="mt-2 text-center text-sm text-vo2">
                We could not save that. Try again.
              </p>
            )}
            <p className="mt-3 text-center text-sm text-muted">Demo mode: no payment is taken in this prototype.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
