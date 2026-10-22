"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import RouteSvg, { type LatLng } from "@/components/RouteSvg";

// A wide view, shown until the runner's location is known.
const DEFAULT_CENTER: LatLng = [20.5937, 78.9629];

/**
 * OpenStreetMap map with the runner's route. Load it with next/dynamic (ssr: false),
 * since Leaflet needs the browser.
 *  - follow: keep the map centred on the latest point while recording
 *  - fit: zoom to show the whole route, for a finished run
 *  - here / accuracy: the runner's current position before a route exists, with a ring for how accurate it is
 */
export default function RouteMap({
  route,
  follow = false,
  fit = false,
  here,
  accuracy,
}: {
  route: LatLng[];
  follow?: boolean;
  fit?: boolean;
  here?: LatLng;
  accuracy?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const dot = useRef<L.CircleMarker | null>(null);
  const ring = useRef<L.Circle | null>(null);
  const centered = useRef(false);
  const [failed, setFailed] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 4);
    let errors = 0;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    // Offline or blocked tiles: after a few failures, show the plain line drawing instead.
    tiles.on("tileerror", () => {
      errors += 1;
      if (errors >= 4) setFailed(true);
    });
    tiles.addTo(m);
    line.current = L.polyline([], { color: "#4c8dff", weight: 5, opacity: 0.95 }).addTo(m);
    dot.current = L.circleMarker(DEFAULT_CENTER, { radius: 8, color: "#4c8dff", weight: 3, fillColor: "#ffffff", fillOpacity: 1 });
    ring.current = L.circle(DEFAULT_CENTER, { radius: 10, color: "#4c8dff", weight: 1, opacity: 0.6, fillColor: "#4c8dff", fillOpacity: 0.12, interactive: false });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Update the line and the position dot when the route changes.
  useEffect(() => {
    const m = map.current;
    if (!m || !line.current || !dot.current) return;
    line.current.setLatLngs(route);
    if (route.length === 0) {
      if (!here) dot.current.remove(); // with no route, the dot shows the runner's position instead
      return;
    }
    const last = route[route.length - 1];
    dot.current.setLatLng(last);
    if (!m.hasLayer(dot.current)) dot.current.addTo(m);
    if (fit && route.length > 1) m.fitBounds(line.current.getBounds(), { padding: [28, 28], animate: false });
    else if (follow) m.setView(last, m.getZoom() < 15 ? 17 : m.getZoom(), { animate: false });
  }, [route, follow, fit, here]);

  // Before a route exists, show where the runner is: the dot, plus a ring for how accurate the fix is.
  // The map centres on them the first time their position is known.
  useEffect(() => {
    const m = map.current;
    if (!m || !dot.current || !ring.current) return;
    if (route.length > 0 || !here) {
      ring.current.remove();
      return;
    }
    dot.current.setLatLng(here);
    if (!m.hasLayer(dot.current)) dot.current.addTo(m);
    ring.current.setLatLng(here).setRadius(Math.max(accuracy ?? 0, 5));
    if (!m.hasLayer(ring.current)) ring.current.addTo(m);
    if (!centered.current) {
      m.setView(here, 16, { animate: false });
      centered.current = true;
    }
  }, [here, accuracy, route.length]);

  return (
    <div className="dark-map relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center gap-2 bg-carbon p-4">
          <RouteSvg route={route} className="h-full w-full" />
          <span className="text-xs text-muted">Map tiles are unavailable. Your route is still being recorded.</span>
        </div>
      )}
    </div>
  );
}
