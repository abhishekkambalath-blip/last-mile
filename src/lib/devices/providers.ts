// The fitness bands a runner can connect. Each one is an OAuth2 login plus a way to list recent running workouts.
// Server only: this file reads the developer secrets from the environment.

export type ProviderId = "whoop" | "polar" | "coros";
export type ProviderState = "available" | "not-configured" | "coming-soon";

export type Tokens = { accessToken: string; refreshToken?: string; expiresAt?: string; providerUserId?: string; scope?: string };
export type ImportedRun = { externalId: string; start: string; distanceKm: number; durationSec: number };

export type Provider = {
  id: ProviderId;
  name: string;
  note: string;
  state: () => ProviderState;
  authorizeUrl: (state: string, redirect: string) => string;
  exchange: (code: string, redirect: string) => Promise<Tokens>;
  refresh?: (t: Tokens) => Promise<Tokens>;
  afterConnect?: (t: Tokens, memberId: string) => Promise<Tokens>;
  fetchRuns: (t: Tokens, sinceIso: string) => Promise<ImportedRun[]>;
  revoke?: (t: Tokens) => Promise<void>;
};

const env = (k: string) => process.env[k] ?? "";
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const isRun = (sport: string | undefined) => /run/i.test(sport ?? "");
const sane = (r: ImportedRun) => r.distanceKm >= 0.3 && r.distanceKm <= 100 && r.durationSec >= 60 && Number.isFinite(Date.parse(r.start));
const secondsFromIso = (iso: string) => {
  const m = /^P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  return m ? Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0) : 0;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url.split("?")[0]} answered ${res.status}`);
  return (await res.json()) as T;
}

// ---- WHOOP (open to any developer: developer.whoop.com) ----
const WHOOP_AUTH = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer/v2";

type WhoopToken = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
const whoopTokens = (t: WhoopToken): Tokens => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token,
  expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : undefined,
  scope: t.scope,
});

const whoop: Provider = {
  id: "whoop",
  name: "WHOOP",
  note: "Imports your running workouts from WHOOP.",
  state: () => (env("WHOOP_CLIENT_ID") && env("WHOOP_CLIENT_SECRET") ? "available" : "not-configured"),
  authorizeUrl: (state, redirect) => `${WHOOP_AUTH}?${form({ response_type: "code", client_id: env("WHOOP_CLIENT_ID"), redirect_uri: redirect, scope: "offline read:workout", state })}`,
  exchange: async (code, redirect) =>
    whoopTokens(
      await json<WhoopToken>(
        await fetch(WHOOP_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: env("WHOOP_CLIENT_ID"), client_secret: env("WHOOP_CLIENT_SECRET") }) }),
      ),
    ),
  // A refresh token works once, so the new one must be saved straight away.
  refresh: async (t) =>
    whoopTokens(
      await json<WhoopToken>(
        await fetch(WHOOP_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "refresh_token", refresh_token: t.refreshToken ?? "", client_id: env("WHOOP_CLIENT_ID"), client_secret: env("WHOOP_CLIENT_SECRET"), scope: "offline" }) }),
      ),
    ),
  fetchRuns: async (t, since) => {
    const out: ImportedRun[] = [];
    let next = "";
    for (let page = 0; page < 8; page++) {
      const q = form({ limit: "25", start: since, ...(next ? { nextToken: next } : {}) });
      const res = await json<{ records: { id: string; start: string; end: string; sport_name?: string; score_state?: string; score?: { distance_meter?: number } }[]; next_token?: string }>(
        await fetch(`${WHOOP_API}/activity/workout?${q}`, { headers: { Authorization: `Bearer ${t.accessToken}` } }),
      );
      for (const w of res.records ?? []) {
        if (!isRun(w.sport_name) || w.score_state !== "SCORED" || !w.score?.distance_meter) continue;
        out.push({ externalId: w.id, start: w.start, distanceKm: w.score.distance_meter / 1000, durationSec: Math.round((Date.parse(w.end) - Date.parse(w.start)) / 1000) });
      }
      if (!res.next_token) break;
      next = res.next_token;
    }
    return out.filter(sane);
  },
  revoke: async (t) => {
    await fetch(`${WHOOP_API}/user/access`, { method: "DELETE", headers: { Authorization: `Bearer ${t.accessToken}` } });
  },
};

// ---- Polar AccessLink (open to any developer: polar.com/accesslink-api) ----
const POLAR_AUTH = "https://flow.polar.com/oauth2/authorization";
const POLAR_TOKEN = "https://polarremote.com/v2/oauth2/token";
const POLAR_API = "https://www.polaraccesslink.com/v3";

const polar: Provider = {
  id: "polar",
  name: "Polar",
  note: "Imports your running exercises from Polar Flow.",
  state: () => (env("POLAR_CLIENT_ID") && env("POLAR_CLIENT_SECRET") ? "available" : "not-configured"),
  authorizeUrl: (state, redirect) => `${POLAR_AUTH}?${form({ response_type: "code", client_id: env("POLAR_CLIENT_ID"), redirect_uri: redirect, state })}`,
  exchange: async (code, redirect) => {
    const basic = Buffer.from(`${env("POLAR_CLIENT_ID")}:${env("POLAR_CLIENT_SECRET")}`).toString("base64");
    const t = await json<{ access_token: string; x_user_id?: number | string; expires_in?: number }>(
      await fetch(POLAR_TOKEN, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form({ grant_type: "authorization_code", code, redirect_uri: redirect }) }),
    );
    // Polar tokens last about a year and have no refresh token.
    return { accessToken: t.access_token, providerUserId: t.x_user_id !== undefined ? String(t.x_user_id) : undefined, expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : undefined };
  },
  // A Polar user must be registered once with your own id for them, or no data flows.
  afterConnect: async (t, memberId) => {
    const res = await fetch(`${POLAR_API}/users`, { method: "POST", headers: { Authorization: `Bearer ${t.accessToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ "member-id": memberId }) });
    if (!res.ok && res.status !== 409) throw new Error(`Polar registration answered ${res.status}`);
    return t;
  },
  fetchRuns: async (t, since) => {
    const list = await json<{ id: string; start_time: string; duration: string; distance?: number; sport?: string; detailed_sport_info?: string }[]>(
      await fetch(`${POLAR_API}/exercises`, { headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" } }),
    );
    return list
      .filter((e) => isRun(e.sport) || isRun(e.detailed_sport_info))
      .filter((e) => Date.parse(e.start_time) >= Date.parse(since))
      .map((e) => ({ externalId: e.id, start: e.start_time, distanceKm: (e.distance ?? 0) / 1000, durationSec: Math.round(secondsFromIso(e.duration)) }))
      .filter(sane);
  },
  revoke: async (t) => {
    if (t.providerUserId) await fetch(`${POLAR_API}/users/${t.providerUserId}`, { method: "DELETE", headers: { Authorization: `Bearer ${t.accessToken}` } });
  },
};

// ---- COROS: the multi-user API is only for approved partners (apply at api@coros.com). Not wired yet. ----
const coros: Provider = {
  id: "coros",
  name: "COROS",
  note: "Needs COROS partner approval before it can be turned on.",
  state: () => "coming-soon",
  authorizeUrl: () => {
    throw new Error("COROS is not available yet.");
  },
  exchange: async () => {
    throw new Error("COROS is not available yet.");
  },
  fetchRuns: async () => [],
};

export const PROVIDERS: Record<ProviderId, Provider> = { whoop, polar, coros };
export const providerOf = (id: string): Provider | null => (id in PROVIDERS ? PROVIDERS[id as ProviderId] : null);
