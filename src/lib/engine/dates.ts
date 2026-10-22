// Dates are plain "yyyy-mm-dd" strings and all maths is done in UTC, so daylight saving never moves a day.
const MS = 86400000;

export const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmtDate(parseDate(s)) === s;
export const addDays = (s: string, n: number) => fmtDate(parseDate(s) + n * MS);
export const diffDays = (a: string, b: string) => Math.round((parseDate(b) - parseDate(a)) / MS); // b - a
/** 0 = Monday ... 6 = Sunday. */
export const weekdayOf = (s: string) => (new Date(parseDate(s)).getUTCDay() + 6) % 7;
export const mondayOf = (s: string) => addDays(s, -weekdayOf(s));
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
