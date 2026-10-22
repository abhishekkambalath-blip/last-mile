"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import PaywallDialog, { priceLabel } from "@/components/PaywallDialog";
import PlanCalendar from "@/components/PlanCalendar";
import RunnerIcon from "@/components/RunnerIcon";
import { firstName, useAccount } from "@/lib/account";
import { daysToRace, FREE_WEEKS, goalLabel, type RunType } from "@/lib/plan";
import { useRuns } from "@/lib/runs";
import { addDays, daysBetween, estMinutes, planStart, sameDay, sessionBg, sessionFor, SESSION_STYLE, startOfDay, stepsFor } from "@/lib/sessions";
import { useSaved } from "@/lib/store";
import { useSubscribed } from "@/lib/subscription";

const card = "rounded-2xl bg-elevated p-4";

const lockSvg = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

function RestHero({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center rounded-3xl px-6 py-10 text-center" style={{ background: "linear-gradient(180deg,#0b3a8a 0%,#16264a 60%,#1b1f29 100%)" }}>
      <div className="relative flex h-32 w-32 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rotate-45 rounded-[2rem] bg-white/5" />
        <span className="absolute inset-4 rotate-45 rounded-[1.6rem] bg-white/10" />
        <span className="absolute inset-9 rotate-45 rounded-2xl bg-[#6f8fe8]" />
      </div>
      <h1 className="mt-8 text-3xl font-extrabold">{name ? `Rest up, ${name}` : "Rest up"}</h1>
      <p className="mt-2 max-w-xs text-subtext">Recovery fuels success, so enjoy the gift of a rest day.</p>
    </div>
  );
}

export default function TodayPage() {
  const { saved, ready } = useSaved();
  const runs = useRuns();
  const account = useAccount();
  const subscribed = useSubscribed();
  const [picked, setPicked] = useState<Date | null>(null);
  const [paywall, setPaywall] = useState(false);

  // The current time is read only after the saved data has loaded in the browser,
  // so nothing time-dependent is baked into the pre-rendered page.
  if (!ready) return <div className="flex-1" />;

  const plan = saved?.plan ?? null;
  const profile = saved?.profile;

  if (!saved || !plan || !profile)
    return (
      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-3xl font-extrabold">No plan yet</h1>
          <p className="text-subtext">Tell us about your race and we&apos;ll build your plan, starting today.</p>
          <Link href="/plan" className="inline-block rounded-full bg-volt px-6 py-3 font-bold text-void">
            Build my plan
          </Link>
        </div>
      </div>
    );

  const today = startOfDay(new Date());
  const start = planStart(saved.createdAt);
  // Only today and later days can be chosen. Past days are never shown.
  const selDate = picked && picked >= today ? picked : today;
  const race = startOfDay(new Date(`${profile.raceDate}T00:00:00`));
  const last = [race, addDays(start, plan.weeks.length * 7 - 1)].sort((a, b) => a.getTime() - b.getTime())[0];

  const found = sessionFor(plan, start, selDate);
  const day = found?.day;
  const run = day && day.type !== "rest" ? day : null;
  const lockedAt = (week: number) => week >= FREE_WEEKS && !subscribed;
  const locked = !!found && lockedAt(found.week);

  // Weekly volume for the plan week we are in now.
  const weekIdx = Math.min(Math.max(Math.floor(daysBetween(start, today) / 7), 0), plan.weeks.length - 1);
  const weekStart = addDays(start, weekIdx * 7);
  const weekLocked = lockedAt(weekIdx);
  const plannedKm = Math.round(plan.weeks[weekIdx].days.reduce((s, d) => s + d.distanceKm, 0) * 10) / 10;
  const loggedKm =
    Math.round(
      runs
        .filter((r) => {
          const d = new Date(r.date);
          return d >= weekStart && d < addDays(weekStart, 7);
        })
        .reduce((s, r) => s + r.distanceKm, 0) * 10,
    ) / 10;
  const pct = plannedKm > 0 ? Math.min(100, (loggedKm / plannedKm) * 100) : 0;
  const lastRun = runs[0];
  const days = daysToRace(profile.raceDate);

  // The next few workouts after the chosen day.
  const upcoming: { date: Date; label: string; meta: string; type: RunType; locked: boolean }[] = [];
  for (let d = addDays(selDate, 1); d <= last && upcoming.length < 4; d = addDays(d, 1)) {
    const f = sessionFor(plan, start, d);
    if (!f || f.day.type === "rest") continue;
    upcoming.push({
      date: d,
      label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      meta: `${f.day.distanceKm} km`,
      type: f.day.type,
      locked: lockedAt(f.week),
    });
  }

  return (
    <div className="flex flex-1 flex-col pb-44">
      {/* Calendar */}
      <section className="bg-elevated pb-4 pt-3">
        <PlanCalendar
          plan={plan}
          start={start}
          raceDate={profile.raceDate}
          runs={runs}
          subscribed={subscribed}
          today={today}
          selected={selDate}
          onSelect={setPicked}
        />
      </section>

      {/* The chosen day */}
      <motion.section key={selDate.toISOString()} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-3xl px-4 pt-5">
        {locked ? (
          <div className="space-y-4 rounded-3xl bg-elevated p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-carbon text-subtext">{lockSvg}</div>
            <div>
              <h1 className="text-2xl font-extrabold">{sameDay(selDate, today) ? "Your free plan has ended" : "This day is locked"}</h1>
              <p className="mt-2 text-sm text-subtext">
                Weeks {FREE_WEEKS + 1} to {plan.weeks.length} are part of the full plan, up to race day.
              </p>
            </div>
            <button onClick={() => setPaywall(true)} className="h-12 w-full rounded-full bg-volt font-bold text-void hover:brightness-110">
              Unlock full plan · {priceLabel} / year
            </button>
          </div>
        ) : run ? (
          <div className="relative overflow-hidden rounded-3xl p-5 text-white" style={{ background: sessionBg(run.type) }}>
            <RunnerIcon className="pointer-events-none absolute -bottom-6 -right-2 h-44 w-44 text-white/15" />
            <div className="text-xs font-bold uppercase tracking-wider text-white/80">
              {sameDay(selDate, today) ? "Today" : selDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
            </div>
            <h1 className="mt-1 text-4xl font-extrabold">{SESSION_STYLE[run.type].label}</h1>
            <div className="mt-4 flex gap-8">
              <div>
                <div className="text-3xl font-extrabold">{run.distanceKm}</div>
                <div className="text-xs font-semibold uppercase text-white/80">km</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold">{estMinutes(run) || "-"}</div>
                <div className="text-xs font-semibold uppercase text-white/80">min</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold">{run.pace.split(" ")[0]}</div>
                <div className="text-xs font-semibold uppercase text-white/80">pace /km</div>
              </div>
            </div>
            <ol className="mt-5 space-y-2 border-t border-white/20 pt-4">
              {stepsFor(run).map((s) => (
                <li key={s.name} className="text-sm">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-white/85"> · {s.detail}</span>
                </li>
              ))}
            </ol>
            {sameDay(selDate, today) && (
              <Link href="/run" className="mt-5 flex h-12 items-center justify-center rounded-full bg-white font-bold text-void">
                Start workout
              </Link>
            )}
          </div>
        ) : day ? (
          <RestHero name={firstName(account)} />
        ) : (
          <div className="py-10 text-center">
            <h1 className="text-2xl font-extrabold">Nothing planned for this day</h1>
            <p className="mt-2 text-subtext">Your plan runs until race day.</p>
            <Link href="/plan" className="mt-4 inline-block font-bold text-teal">
              See your plan
            </Link>
          </div>
        )}
      </motion.section>

      {/* Coming up */}
      {upcoming.length > 0 && (
        <section className="mx-auto mt-6 w-full max-w-3xl space-y-3 px-4">
          <h2 className="text-xl font-extrabold">Coming up</h2>
          <ul className="space-y-2">
            {upcoming.map((u) => (
              <li key={u.date.toISOString()}>
                <button
                  type="button"
                  onClick={() => setPicked(u.date)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-elevated p-3 text-left transition hover:bg-white/10"
                >
                  <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: u.locked ? "#6f7888" : sessionBg(u.type) }} />
                  <span className="flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted">{u.label}</span>
                    <span className="block font-bold">{u.locked ? "Locked" : SESSION_STYLE[u.type].label}</span>
                  </span>
                  <span className="text-sm font-semibold text-subtext">{u.locked ? <span className="text-muted">{lockSvg}</span> : u.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Insights */}
      <section className="mx-auto mt-6 w-full max-w-3xl space-y-3">
        <h2 className="px-4 text-xl font-extrabold">My insights</h2>
        <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          <div className={`${card} min-w-[250px] snap-start`}>
            <div className="text-sm text-subtext">Weekly volume</div>
            {weekLocked ? (
              <>
                <div className="mt-2 text-3xl font-extrabold">
                  {loggedKm}
                  <span className="text-base font-semibold text-subtext"> km logged</span>
                </div>
                <button onClick={() => setPaywall(true)} className="mt-3 text-sm font-bold text-teal">
                  Unlock this week&apos;s plan
                </button>
              </>
            ) : (
              <>
                <div className="mt-2 text-3xl font-extrabold">
                  {loggedKm}
                  <span className="text-base font-semibold text-subtext"> of {plannedKm || "-"} km</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-carbon">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full bg-teal" />
                </div>
              </>
            )}
          </div>
          <div className={`${card} min-w-[250px] snap-start`}>
            <div className="text-sm text-subtext">{goalLabel(profile)} race</div>
            <div className="mt-2 text-3xl font-extrabold">
              {days}
              <span className="text-base font-semibold text-subtext"> days to go</span>
            </div>
            <div className="mt-3 text-sm text-subtext">Goal pace {profile.goalPace} /km</div>
          </div>
          <div className={`${card} min-w-[250px] snap-start`}>
            <div className="text-sm text-subtext">Last run</div>
            {lastRun ? (
              <>
                <div className="mt-2 text-3xl font-extrabold">
                  {lastRun.distanceKm}
                  <span className="text-base font-semibold text-subtext"> km</span>
                </div>
                <div className="mt-3 text-sm text-subtext">
                  {lastRun.paceMinPerKm} /km{lastRun.checkIn ? ` · effort ${lastRun.checkIn.effort}/10` : ""}
                </div>
              </>
            ) : (
              <div className="mt-2 text-subtext">No runs recorded yet. Tap Record workout to start.</div>
            )}
          </div>
        </div>
      </section>

      <PaywallDialog open={paywall} onClose={() => setPaywall(false)} totalWeeks={plan.weeks.length} raceDate={profile.raceDate} />
      <BottomTabs />
    </div>
  );
}
