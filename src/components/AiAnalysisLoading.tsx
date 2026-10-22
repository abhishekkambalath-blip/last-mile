"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const PHASES = [
  { id: "01", title: "Reading your goal", detail: "Race distance, date, level and injury notes" },
  { id: "02", title: "Setting safe volume", detail: "Weekly distance, rest days and the 10% growth limit" },
  { id: "03", title: "Calibrating paces", detail: "Easy and long-run paces from your goal pace" },
];

const MIN_MS = 4200; // long enough to read the three phases, even if the plan is ready sooner

/**
 * Telemetry-style progress screen. It never finishes before `done` is true,
 * and calls `onFinished` once both the animation and the real work are complete.
 */
export default function AiAnalysisLoading({ done, onFinished }: { done: boolean; onFinished: () => void }) {
  const [progress, setProgress] = useState(0);
  const start = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    start.current = performance.now();
    const id = setInterval(() => {
      const elapsed = performance.now() - start.current;
      const target = Math.min((elapsed / MIN_MS) * 100, 100);
      // Hold at 94% until the plan is actually ready.
      setProgress((p) => Math.max(p, done ? target : Math.min(target, 94)));
    }, 80);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (done && progress >= 100 && !finished.current) {
      finished.current = true;
      onFinished();
    }
  }, [done, progress, onFinished]);

  const phase = progress < 34 ? 0 : progress < 68 ? 1 : 2;

  return (
    <div className="mx-auto w-full max-w-md space-y-8 text-center" role="status" aria-live="polite">
      {/* Radar sweep */}
      <div className="relative mx-auto h-44 w-44">
        <div className="absolute inset-0 rounded-full border border-volt/30" />
        <div className="absolute inset-6 rounded-full border border-volt/20" />
        <div className="absolute inset-12 rounded-full border border-volt/10" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, rgba(190,242,100,0.35), rgba(190,242,100,0) 25%)",
            animation: "sweep 2.2s linear infinite",
          }}
        />
        <div
          className="absolute inset-0 rounded-full border border-volt/50"
          style={{ animation: "pulse-ring 2s ease-out infinite" }}
        />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt shadow-[0_0_12px_#BEF264]" />
      </div>

      <div>
        <div className="font-mono-tech text-5xl font-semibold tabular-nums text-volt">{String(Math.floor(progress)).padStart(2, "0")}%</div>
        <div className="mt-1 font-mono-tech text-[11px] uppercase tracking-[0.25em] text-muted">Building your plan</div>
      </div>

      <ol className="space-y-2 text-left">
        {PHASES.map((p, i) => {
          const state = i < phase ? "done" : i === phase ? "active" : "wait";
          return (
            <li
              key={p.id}
              className={`flex items-start gap-3 rounded-md border px-3 py-2.5 transition ${
                state === "active" ? "border-volt/40 bg-volt/5" : "border-line bg-carbon"
              }`}
            >
              <span
                className={`font-mono-tech text-xs font-semibold ${
                  state === "wait" ? "text-muted" : "text-volt"
                }`}
              >
                {state === "done" ? "✓" : p.id}
              </span>
              <div>
                <div className={`text-sm font-semibold ${state === "wait" ? "text-muted" : "text-ink"}`}>{p.title}</div>
                <AnimatePresence initial={false}>
                  {state !== "wait" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden font-mono-tech text-[11px] text-subtext"
                    >
                      {p.detail}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
