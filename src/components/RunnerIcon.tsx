/** A simple original running-figure glyph. Color comes from the surrounding text color. */
export default function RunnerIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="31" cy="9" r="4" fill="currentColor" stroke="none" />
      <path d="M26 17l-7 9 7 4-3 12" />
      <path d="M26 17l8 5 6-3" />
      <path d="M19 26l-9 2" />
      <path d="M26 30l8 3 2 8" />
    </svg>
  );
}
