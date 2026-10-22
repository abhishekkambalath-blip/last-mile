"use client";

import { useState } from "react";
import { FREE_WEEKS, type Plan, type RunType } from "@/lib/plan";
import type { Run } from "@/lib/runs";
import { addDays, daysBetween, sameDay, SESSION_STYLE, sessionBg, sessionFor, startOfDay } from "@/lib/sessions";

type Info = { type: RunType | null; km: number; locked: boolean; done: boolean; race: boolean };

const lockSvg = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Locked">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const flagSvg = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-label="Race day">
    <path d="M6 3v18h2v-7h9l-2-4 2-4H8V3z" />
  </svg>
);

const checkBadge = (
  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-[#2e8b0f]" aria-label="Run recorded">
    ✓
  </span>
);

/**
 * Calendar for the Today screen. A strip of dates from today onward, and a month view.
 * Days with a workout are filled with that run type's colour, the same as its card.
 * Days that have passed are never shown as choices.
 */
export default function PlanCalendar({
  plan,
  start,
  raceDate,
  runs,
  subscribed,
  today,
  selected,
  onSelect,
}: {
  plan: Plan;
  start: Date;
  raceDate: string;
  runs: Run[];
  subscribed: boolean;
  today: Date;
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const [monthOpen, setMonthOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const race = startOfDay(new Date(`${raceDate}T00:00:00`));
  const planEnd = addDays(start, plan.weeks.length * 7 - 1);
  const last = race < planEnd ? race : planEnd;

  const info = (date: Date): Info => {
    const f = sessionFor(plan, start, date);
    return {
      type: f && f.day.type !== "rest" ? f.day.type : null,
      km: f?.day.distanceKm ?? 0,
      locked: !!f && f.week >= FREE_WEEKS && !subscribed,
      done: runs.some((r) => sameDay(new Date(r.date), date)),
      race: sameDay(date, race),
    };
  };

  const stripCount = Math.max(1, Math.min(28, daysBetween(today, last) + 1));
  const strip = Array.from({ length: stripCount }, (_, i) => addDays(today, i));

  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(last.getFullYear(), last.getMonth(), 1);
  const monthLabel = (d: Date) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const lead = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  // Run types that appear in the open weeks, for the colour key.
  const types = [...new Set(plan.weeks.filter((_, i) => i < FREE_WEEKS || subscribed).flatMap((w) => w.days.map((d) => d.type)))].filter((t) => t !== "rest");

  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4">
        <h2 className="text-lg font-extrabold">{monthLabel(selected)}</h2>
        <button
          type="button"
          aria-expanded={monthOpen}
          onClick={() => {
            setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
            setMonthOpen((o) => !o);
          }}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-black/30 transition hover:brightness-110"
          style={{ background: "linear-gradient(120deg,#0047AB,#2f7bff)" }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M4 10h16M9 3v4M15 3v4" />
          </svg>
          {monthOpen ? "Hide calendar" : "Calendar"}
        </button>
      </div>

      {/* Strip of upcoming days: each workout day is a tile in its run type's colour. */}
      <div className="mx-auto max-w-3xl">
        <div className="flex snap-x scroll-pl-4 gap-2 overflow-x-auto px-4 pb-2 pt-1" role="listbox" aria-label="Upcoming days">
          {strip.map((date, i) => {
            const active = sameDay(date, selected);
            const inf = info(date);
            const colored = !!inf.type && !inf.locked;
            const light = active && !colored; // a selected rest or locked day turns white
            return (
              <button
                key={date.toISOString()}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(date)}
                style={colored ? { background: sessionBg(inf.type as RunType) } : undefined}
                className={`flex w-[3.7rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition ${
                  light ? "bg-white text-void" : colored ? "text-white" : "bg-carbon text-ink hover:bg-white/10"
                } ${active ? "scale-105 shadow-lg shadow-black/40 ring-2 ring-white" : colored ? "opacity-90 hover:opacity-100" : ""}`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${light ? "text-void/60" : colored ? "text-white/80" : "text-muted"}`}>
                  {i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="text-xl font-extrabold leading-none">{date.getDate()}</span>
                <span className={`flex h-4 items-center justify-center text-[10px] font-bold ${light ? "text-void/70" : colored ? "text-white/90" : "text-subtext"}`}>
                  {inf.race ? flagSvg : inf.done ? checkBadge : inf.locked ? lockSvg : inf.type ? `${inf.km} km` : <span className="h-1.5 w-1.5 rounded-full bg-muted/50" aria-label="Rest day" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Month view */}
      {monthOpen && (
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-3xl bg-carbon p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                disabled={month <= firstMonth}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-subtext hover:bg-white/10 disabled:opacity-30"
              >
                ‹
              </button>
              <span className="font-bold">{monthLabel(month)}</span>
              <button
                type="button"
                aria-label="Next month"
                disabled={month >= lastMonth}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-subtext hover:bg-white/10 disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1.5 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="pb-1 text-[11px] font-bold text-muted">
                  {d}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
                const out = date < today || date > last;
                const active = sameDay(date, selected);
                const isToday = sameDay(date, today);
                const inf = out ? null : info(date);
                const colored = !!inf?.type && !inf.locked;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={out}
                    aria-label={date.toDateString()}
                    aria-pressed={active}
                    onClick={() => onSelect(date)}
                    className={`mx-auto flex h-12 w-11 flex-col items-center justify-center gap-0.5 ${out ? "opacity-25" : ""}`}
                  >
                    <span
                      style={colored ? { background: sessionBg(inf!.type as RunType) } : undefined}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                        colored ? "text-white" : active ? "bg-white text-void" : "text-ink hover:bg-white/10"
                      } ${active ? "scale-110 ring-2 ring-white" : isToday ? "ring-1 ring-white/50" : ""}`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex h-3 items-center text-subtext">
                      {inf?.race ? flagSvg : inf?.done ? checkBadge : inf?.locked ? lockSvg : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-subtext" aria-label="Colour key">
              {types.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sessionBg(t) }} />
                  {SESSION_STYLE[t].label}
                </li>
              ))}
              <li className="flex items-center gap-1.5 text-threshold">
                {flagSvg} <span className="text-subtext">Race day</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
