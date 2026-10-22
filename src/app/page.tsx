"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { daysToRace, weeksToRace, type Profile } from "@/lib/plan";
import { useSaved, writeSaved } from "@/lib/store";

const empty: Profile = { goalPace: "", distance: "" as Profile["distance"], raceDate: "", level: "", injury: "" };

// The onboarding form keeps the brand blue.
const BLUE = "#0047AB";

const field =
  "w-full rounded-md border border-line bg-carbon px-3 py-2.5 text-ink placeholder:text-muted outline-none transition focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/50";
const labelCls = "block space-y-1.5 font-mono-tech text-[11px] font-medium uppercase tracking-wider text-subtext";

type Option<T extends string> = { value: T; color: string; hint: string };

const GOALS: Option<Profile["distance"]>[] = [
  { value: "5K", color: "#ef4444", hint: "5 km" }, // red
  { value: "10K", color: "#f97316", hint: "10 km" }, // orange
  { value: "21K", color: "#22c55e", hint: "21.1 km" }, // green
  { value: "Marathon", color: "#9ca3af", hint: "42.2 km" }, // gray
];

const LEVELS: Option<Exclude<Profile["level"], "">>[] = [
  { value: "Beginner", color: "#93c5fd", hint: "New to running" }, // light blue
  { value: "Intermediate", color: "#3b82f6", hint: "Some races" }, // mid blue
  { value: "Advanced", color: "#2563eb", hint: "Regular racer" }, // deep blue
];

const star = (
  <span className="text-vo2" aria-hidden="true">
    *
  </span>
);

function Picker<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  labelId,
  required = false,
}: {
  options: Option<T>[];
  value: string;
  onChange: (v: T) => void;
  placeholder: string;
  labelId: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = options.find((g) => g.value === value);

  // Close when the runner clicks elsewhere or presses Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      {/* Invisible input so the browser's "required" check and message still work. */}
      <input
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => {}}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((o) => !o)}
        className={`${field} flex items-center justify-between text-left normal-case tracking-normal`}
      >
        <span className="flex items-center gap-2" style={{ color: current?.color }}>
          {current && <span className="h-3 w-3 rounded-full" style={{ background: current.color }} />}
          <span className={current ? "font-semibold" : "text-muted"}>{current?.value ?? placeholder}</span>
        </span>
        <span className="text-muted">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line bg-elevated shadow-xl shadow-black/50"
        >
          {options.map((g) => (
            <li key={g.value} role="option" aria-selected={g.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(g.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-semibold normal-case tracking-normal hover:bg-white/5"
                style={{ color: g.color }}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                {g.value}
                <span className="ml-auto font-mono-tech text-[11px] font-normal text-muted">{g.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

function OnboardingForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initial);
  const set = (k: keyof Profile) => (e: { target: { value: string } }) =>
    setProfile((p) => ({ ...p, [k]: e.target.value }));

  const hasDate = profile.raceDate && !Number.isNaN(Date.parse(profile.raceDate));
  const days = hasDate ? daysToRace(profile.raceDate) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // The /build page runs the analysis so the runner sees the progress screen.
    writeSaved({ profile, plan: null });
    router.push("/build");
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-3xl border border-line border-t-4 bg-elevated p-6 shadow-2xl shadow-black/40"
      style={{ borderTopColor: BLUE }}
    >
      <h2 className="font-mono-tech text-xs font-semibold uppercase tracking-[0.2em] text-subtext">Onboarding</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className={labelCls}>
          <span id="goal-label">Your goal {star}</span>
          <Picker
            options={GOALS}
            value={profile.distance}
            onChange={(v) => setProfile((p) => ({ ...p, distance: v }))}
            placeholder="Select your goal"
            labelId="goal-label"
            required
          />
        </div>
        <label className={labelCls}>
          Race date {star}
          <input
            type="date"
            required
            min={tomorrow()}
            className={`${field} font-mono-tech`}
            value={profile.raceDate}
            onChange={set("raceDate")}
          />
        </label>
      </div>

      {hasDate && days > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-volt/30 bg-volt/5 px-3 py-2 font-mono-tech text-xs font-semibold uppercase tracking-wider text-volt"
        >
          ⚡ {weeksToRace(profile.raceDate)} weeks • {days} days out
        </motion.div>
      )}

      <label className={labelCls}>
        Your goal pace (minutes per km) {star}
        <input
          required
          inputMode="numeric"
          placeholder="6:30"
          pattern="\d{1,2}:[0-5]\d"
          title="Use the format 6:30"
          className={`${field} font-mono-tech`}
          value={profile.goalPace}
          onChange={set("goalPace")}
        />
      </label>

      <div className={labelCls}>
        <span id="level-label">Running history</span>
        <Picker
          options={LEVELS}
          value={profile.level}
          onChange={(v) => setProfile((p) => ({ ...p, level: v }))}
          placeholder="Select your level"
          labelId="level-label"
        />
      </div>

      <label className={labelCls}>
        Any injury? (leave blank if none)
        <textarea
          rows={2}
          placeholder="e.g. Knee pain after my first 10K"
          className={field}
          value={profile.injury}
          onChange={set("injury")}
        />
      </label>

      <button
        className="w-full rounded-2xl px-4 py-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white transition hover:-translate-y-px hover:brightness-125"
        style={{ background: BLUE }}
      >
        Build my plan
      </button>
    </form>
  );
}

const VALID_GOALS = GOALS.map((g) => g.value as string);

export default function Home() {
  const { saved, ready } = useSaved();
  // Earlier answers prefill the form. Drop any goal value this version no longer offers.
  const initial = saved?.profile ?? empty;
  const profile: Profile = VALID_GOALS.includes(initial.distance) ? initial : { ...initial, distance: "" as Profile["distance"] };

  return (
    <div className="flex flex-1 justify-center px-4 pb-16 pt-10">
      <main className="w-full max-w-xl space-y-8">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-chrome text-6xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-8xl">
            Last <span className="text-aurora">Mile</span>
          </h1>
          <p className="mt-2 text-subtext">Tell us about yourself and we&apos;ll build your first two weeks.</p>
        </motion.header>

        {ready ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <OnboardingForm initial={profile} />
          </motion.div>
        ) : (
          <div className="h-96 animate-pulse rounded-xl bg-elevated" />
        )}
      </main>
    </div>
  );
}
