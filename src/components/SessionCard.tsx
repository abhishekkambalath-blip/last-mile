import type { ReactNode } from "react";
import RunnerIcon from "@/components/RunnerIcon";
import type { RunType } from "@/lib/plan";
import { SESSION_STYLE, sessionBg } from "@/lib/sessions";

/** A gradient tile for one session. The color tells the run type at a glance. */
export default function SessionCard({
  type,
  dayLabel,
  meta,
  onClick,
  expanded,
  children,
}: {
  type: RunType;
  dayLabel: string;
  meta: string;
  onClick?: () => void;
  expanded?: boolean;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={onClick ? expanded : undefined}
        className="relative block w-full overflow-hidden rounded-2xl p-4 text-left text-white transition active:scale-[0.99]"
        style={{ background: sessionBg(type) }}
      >
        <div className="flex items-start justify-between">
          <RunnerIcon className="h-6 w-6" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/80">{dayLabel}</span>
        </div>
        <div className="mt-7 flex items-end justify-between gap-3">
          <span className="text-xl font-extrabold leading-none">{SESSION_STYLE[type].label}</span>
          <span className="text-sm font-semibold text-white/90">{meta}</span>
        </div>
        <RunnerIcon className="pointer-events-none absolute -bottom-4 right-6 h-24 w-24 text-white/15" />
      </button>
      {children}
    </div>
  );
}
