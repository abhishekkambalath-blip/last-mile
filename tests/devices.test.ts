import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { open, seal } from "@/lib/devices/crypto";
import { PROVIDERS, providerOf } from "@/lib/devices/providers";

beforeEach(() => {
  process.env.DEVICE_TOKEN_KEY = "a".repeat(64);
  process.env.WHOOP_CLIENT_ID = "wid";
  process.env.WHOOP_CLIENT_SECRET = "wsecret";
});
afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("tokens are encrypted and come back the same", () => {
  const sealed = seal('{"accessToken":"secret"}');
  expect(sealed).not.toContain("secret");
  expect(open(sealed)).toBe('{"accessToken":"secret"}');
  expect(() => open(sealed.replace(/.$/, "A"))).toThrow(); // a changed token is refused
});

test("unknown devices are rejected, COROS is not available yet", () => {
  expect(providerOf("fitbit")).toBeNull();
  expect(PROVIDERS.coros.state()).toBe("coming-soon");
  expect(() => PROVIDERS.coros.authorizeUrl("s", "r")).toThrow();
});

test("WHOOP login address carries the state, the redirect and the offline scope", () => {
  const url = new URL(PROVIDERS.whoop.authorizeUrl("abc123", "https://app.test/api/devices/whoop/callback"));
  expect(url.origin + url.pathname).toBe("https://api.prod.whoop.com/oauth/oauth2/auth");
  expect(url.searchParams.get("state")).toBe("abc123");
  expect(url.searchParams.get("scope")).toBe("offline read:workout");
  expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/api/devices/whoop/callback");
});

test("WHOOP: only scored running workouts with a distance are imported", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      reply({
        records: [
          { id: "a", start: "2026-10-20T06:00:00Z", end: "2026-10-20T06:30:00Z", sport_name: "running", score_state: "SCORED", score: { distance_meter: 5000 } },
          { id: "b", start: "2026-10-19T06:00:00Z", end: "2026-10-19T07:00:00Z", sport_name: "cycling", score_state: "SCORED", score: { distance_meter: 20000 } },
          { id: "c", start: "2026-10-18T06:00:00Z", end: "2026-10-18T06:30:00Z", sport_name: "running", score_state: "PENDING_SCORE" },
        ],
      }),
    ),
  );
  const runs = await PROVIDERS.whoop.fetchRuns({ accessToken: "t" }, "2026-10-01T00:00:00Z");
  expect(runs).toEqual([{ externalId: "a", start: "2026-10-20T06:00:00Z", distanceKm: 5, durationSec: 1800 }]);
});

test("Polar: runs are read from the list, with the ISO duration turned into seconds", async () => {
  process.env.POLAR_CLIENT_ID = "p";
  process.env.POLAR_CLIENT_SECRET = "s";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      reply([
        { id: "x1", start_time: "2026-10-20T06:00:00", duration: "PT1H2M3S", distance: 10000, sport: "RUNNING" },
        { id: "x2", start_time: "2026-10-20T06:00:00", duration: "PT45M", distance: 12000, sport: "CYCLING" },
        { id: "x3", start_time: "2026-09-01T06:00:00", duration: "PT30M", distance: 5000, sport: "RUNNING" },
      ]),
    ),
  );
  const runs = await PROVIDERS.polar.fetchRuns({ accessToken: "t" }, "2026-10-01T00:00:00Z");
  expect(runs).toEqual([{ externalId: "x1", start: "2026-10-20T06:00:00", distanceKm: 10, durationSec: 3723 }]);
});

test("a failing band answers with an error, not a half result", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => reply({}, 401)));
  await expect(PROVIDERS.whoop.fetchRuns({ accessToken: "t" }, "2026-10-01T00:00:00Z")).rejects.toThrow();
});
