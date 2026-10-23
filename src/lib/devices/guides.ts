import type { DeviceInfo } from "@/lib/devices/client";

// Plain-language steps for connecting each band: what to do once to set it up, and what a runner does.
// `origin` is the address the app runs at (the band's login must send people back to it).

export const callbackUrl = (origin: string, id: string) => `${origin}/api/devices/${id}/callback`;
/** Strava wants only the address, with no https:// and no port. */
export const callbackDomain = (origin: string) => origin.replace(/^https?:\/\//, "").replace(/:\d+$/, "");

export type Guide = {
  setup: string[]; // done once by whoever runs the app
  runner: string[]; // done by each runner
  link?: { label: string; href: string };
};

const KEYS = (a: string, b: string) => `Copy the Client ID and Client Secret into ${a} and ${b}, in your .env file and in Vercel's Environment Variables for the live site.`;
const RESTART = "Restart the app (or redeploy on Vercel) so it picks the keys up.";

export function guideFor(id: string, origin: string): Guide {
  const host = callbackDomain(origin);
  switch (id) {
    case "whoop":
      return {
        link: { label: "Open the WHOOP developer dashboard", href: "https://developer.whoop.com" },
        setup: [
          "Open developer.whoop.com and sign in with your WHOOP account.",
          `In the Developer Dashboard, create an app. Set its Redirect URL to ${callbackUrl(origin, "whoop")}`,
          "Allow the scopes read:workout and offline.",
          KEYS("WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET"),
          RESTART,
        ],
        runner: ["Tap Connect.", "Sign in to WHOOP and tap Allow.", "You come back to this page. Tap Sync now to bring in your runs.", "Tap Sync now again after each workout."],
      };
    case "polar":
      return {
        link: { label: "Open Polar AccessLink admin", href: "https://admin.polaraccesslink.com" },
        setup: [
          "Open admin.polaraccesslink.com and sign in with your Polar Flow account.",
          `Create a new client. Set its Authorization callback URL to ${callbackUrl(origin, "polar")}`,
          KEYS("POLAR_CLIENT_ID", "POLAR_CLIENT_SECRET"),
          RESTART,
        ],
        runner: ["Tap Connect.", "Sign in to Polar Flow and accept.", "You come back to this page. Tap Sync now to bring in your runs.", "A run only appears after your watch has synced it to Polar Flow. Tap Sync now after that."],
      };
    case "strava":
      return {
        link: { label: "Open Strava API settings", href: "https://www.strava.com/settings/api" },
        setup: [
          "Open strava.com/settings/api and sign in with a Strava account.",
          `Create an app: any name, a category, a website. Set Authorization Callback Domain to ${host} (just the address, with no https:// and no path).`,
          KEYS("STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"),
          RESTART,
          "Strava may allow only a few athletes for a new app until you ask Strava for more. Check the limit shown on your app's page.",
        ],
        runner: [
          "Tap Connect.",
          "Sign in to Strava and tap Authorize.",
          "You come back to this page. Tap Sync now to bring in your runs.",
          "Runs set to Only you in Strava are not shared. Tap Sync now after each run.",
          "Wear a Garmin, COROS, Apple Watch or another band? Link it to Strava in its own app, and its runs arrive here through Strava.",
        ],
      };
    case "coros":
      return {
        setup: ["COROS gives its API only to approved partners. Apply at api@coros.com. Until then COROS cannot connect directly."],
        runner: ["For now, link Strava in the COROS app's settings, then connect Strava here. Your COROS runs will arrive through Strava."],
      };
    default:
      return { setup: [], runner: [] };
  }
}

/** The one thing to do next for a band, from where it stands now. */
export function nextStep(d: DeviceInfo, ctx: { backendOn: boolean; loaded: boolean; serverReady: boolean }): string {
  if (d.id === "coros") return "Connect Strava instead. COROS has no direct connection yet.";
  if (!ctx.backendOn) return "Turn on the backend first: add your Supabase keys (see supabase/README.md), then reload.";
  if (!ctx.loaded) return "Checking the server…";
  if (!ctx.serverReady) return "Finish the server setup: add SUPABASE_SERVICE_ROLE_KEY and DEVICE_TOKEN_KEY, then restart.";
  if (d.state === "not-configured") return `Register your app with ${d.name} and add its keys. Follow the setup steps below.`;
  if (!d.connected) return `Tap Connect and sign in to ${d.name}.`;
  if (!d.lastSyncedAt) return "Tap Sync now to bring in your runs.";
  return "You are set. Tap Sync now after each workout.";
}
