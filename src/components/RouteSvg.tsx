export type LatLng = [number, number];

/**
 * Draws a route as a plain line. Works offline, so it is used for small thumbnails
 * and as the fallback when the map tiles cannot load.
 */
export default function RouteSvg({ route, className = "" }: { route: LatLng[]; className?: string }) {
  if (route.length < 2)
    return <div className={`flex items-center justify-center text-xs text-muted ${className}`}>No route yet</div>;

  const lat0 = route.reduce((s, p) => s + p[0], 0) / route.length;
  const kx = Math.cos((lat0 * Math.PI) / 180); // keeps the shape true at this latitude
  const pts = route.map(([la, ln]) => [ln * kx, -la] as const);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1e-7);
  const h = Math.max(Math.max(...ys) - minY, 1e-7);
  const scale = Math.min(280 / w, 140 / h);
  const ox = (300 - w * scale) / 2;
  const oy = (160 - h * scale) / 2;
  const at = (p: readonly [number, number]) => [ox + (p[0] - minX) * scale, oy + (p[1] - minY) * scale] as const;
  const line = pts.map((p) => at(p).join(",")).join(" ");
  const [sx, sy] = at(pts[0]);
  const [ex, ey] = at(pts[pts.length - 1]);

  return (
    <svg viewBox="0 0 300 160" className={className} role="img" aria-label="Route of this run" preserveAspectRatio="xMidYMid meet">
      <polyline points={line} fill="none" stroke="#4c8dff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r="5" fill="#58b91e" />
      <circle cx={ex} cy={ey} r="5" fill="#ffffff" stroke="#4c8dff" strokeWidth="2" />
    </svg>
  );
}
