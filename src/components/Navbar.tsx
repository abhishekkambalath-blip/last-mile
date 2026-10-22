"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { daysToRace } from "@/lib/plan";
import { useSaved, writeSaved } from "@/lib/store";

const STEPS = [
  { n: "01", label: "Race parameters", paths: ["/"] },
  { n: "02", label: "Analysis", paths: ["/build"] },
  { n: "03", label: "Blueprint", paths: ["/plan", "/run"] },
];

export default function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const { saved } = useSaved();
  const profile = saved?.profile;
  const current = STEPS.findIndex((s) => s.paths.includes(path));
  const days = profile?.raceDate ? daysToRace(profile.raceDate) : null;

  function reset() {
    if (!window.confirm("Clear your plan and start again?")) return;
    writeSaved(null);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link href="/" className="whitespace-nowrap text-sm font-extrabold uppercase tracking-[0.18em] text-ink">
          Last <span className="text-aurora">Mile</span>
        </Link>

        {/* Phase indicator: full trail on wider screens, just the current step on phones. */}
        <ol className="ml-2 hidden items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider sm:flex">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted">→</span>}
              <span className={i === current ? "text-volt" : i < current ? "text-subtext" : "text-muted"}>
                {s.n} {s.label}
              </span>
            </li>
          ))}
        </ol>
        {current >= 0 && (
          <span className="whitespace-nowrap font-mono-tech text-[11px] uppercase tracking-wider text-volt sm:hidden">
            Step {STEPS[current].n}/03
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {profile && (
            <>
              <span className="rounded border border-line bg-carbon px-2 py-1 font-mono-tech text-[11px] font-semibold uppercase text-ink">
                {profile.distance}
              </span>
              {days !== null && (
                <span className="rounded border border-volt/40 bg-volt/10 px-2 py-1 font-mono-tech text-[11px] font-semibold uppercase text-volt">
                  {days}D
                </span>
              )}
              <button
                onClick={reset}
                className="rounded border border-line px-2 py-1 font-mono-tech text-[11px] uppercase text-subtext transition hover:border-vo2/60 hover:text-vo2"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
