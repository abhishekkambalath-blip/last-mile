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

test("Strava: only runs are imported, in km and seconds, and 'after' is sent as epoch seconds", async () => {
  process.env.STRAVA_CLIENT_ID = "1";
  process.env.STRAVA_CLIENT_SECRET = "s";
  const fetchMock = vi.fn(async () =>
    reply([
      { id: 11, sport_type: "Run", distance: 8000, moving_time: 2400, start_date: "2026-10-20T01:00:00Z" },
      { id: 12, sport_type: "TrailRun", distance: 12000, moving_time: 4800, start_date: "2026-10-19T01:00:00Z" },
      { id: 13, sport_type: "Ride", distance: 30000, moving_time: 3600, start_date: "2026-10-18T01:00:00Z" },
      { id: 14, sport_type: "Run", distance: 100, moving_time: 30, start_date: "2026-10-17T01:00:00Z" }, // too short to count
    ]),
  );
  vi.stubGlobal("fetch", fetchMock);
  const runs = await PROVIDERS.strava.fetchRuns({ accessToken: "t" }, "2026-10-01T00:00:00Z");
  expect(runs.map((r) => [r.externalId, r.distanceKm, r.durationSec])).toEqual([
    ["11", 8, 2400],
    ["12", 12, 4800],
  ]);
  const called = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
  expect(called.searchParams.get("after")).toBe(String(Date.parse("2026-10-01T00:00:00Z") / 1000));
});

test("Strava: login address asks for activity:read, and token expiry comes from epoch seconds", async () => {
  process.env.STRAVA_CLIENT_ID = "1";
  process.env.STRAVA_CLIENT_SECRET = "s";
  const u = new URL(PROVIDERS.strava.authorizeUrl("st", "https://app.test/api/devices/strava/callback"));
  expect(u.origin + u.pathname).toBe("https://www.strava.com/oauth/authorize");
  expect(u.searchParams.get("scope")).toBe("activity:read");
  expect(u.searchParams.get("response_type")).toBe("code");
  vi.stubGlobal("fetch", vi.fn(async () => reply({ access_token: "a", refresh_token: "r", expires_at: 1800000000, athlete: { id: 7 } })));
  const t = await PROVIDERS.strava.exchange("code", "x");
  expect(t).toMatchObject({ accessToken: "a", refreshToken: "r", providerUserId: "7", expiresAt: new Date(1800000000 * 1000).toISOString() });
});
