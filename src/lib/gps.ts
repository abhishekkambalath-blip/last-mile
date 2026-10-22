export type Point = { lat: number; lng: number; t: number; accuracy: number };

// Ignore fixes the phone itself says are poor (metres).
export const MAX_ACCURACY_M = 30;
// Ignore tiny jitter while standing still (metres).
const MIN_STEP_M = 3;
// Faster than this between two fixes is not a human run (~2:00 min/km). Flag it for review.
export const SPIKE_SPEED_MS = 8.3;

export function haversineM(a: Point, b: Point) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Track = { points: Point[]; distanceM: number; spike: boolean };

export const newTrack = (): Track => ({ points: [], distanceM: 0, spike: false });

/** Adds a GPS fix. Returns the same track object (mutated) so callers can keep it in a ref. */
export function addPoint(track: Track, p: Point): Track {
  if (p.accuracy > MAX_ACCURACY_M) return track;
  const last = track.points[track.points.length - 1];
  if (!last) {
    track.points.push(p);
    return track;
  }
  const d = haversineM(last, p);
  if (d < MIN_STEP_M) return track;
  const dt = (p.t - last.t) / 1000;
  if (dt > 0 && d / dt > SPIKE_SPEED_MS) {
    // Do not count the jump into the distance, but remember it happened.
    track.spike = true;
    return track;
  }
  track.distanceM += d;
  track.points.push(p);
  return track;
}

/** Pace in "m:ss" per km, or "-" when there is not enough data. */
export function formatPace(distanceM: number, seconds: number) {
  if (distanceM < 50 || seconds <= 0) return "-";
  const secPerKm = seconds / (distanceM / 1000);
  if (secPerKm > 3600) return "-";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${s === 60 ? m + 1 : m}:${String(s === 60 ? 0 : s).padStart(2, "0")}`;
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Thins a route to at most `max` points (always keeping the first and last) for saving and drawing. */
export function simplifyRoute(points: Point[], max = 200): [number, number][] {
  if (points.length === 0) return [];
  const step = Math.max(1, Math.ceil(points.length / max));
  const out = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  return out.map((p) => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5]);
}
