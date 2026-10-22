import { providerOf } from "@/lib/devices/providers";
import { loadTokens, saveTokens } from "@/lib/devices/store";
import { adminClient, userFrom } from "@/lib/supabase";

const FIRST_SYNC_DAYS = 30;

// Pulls the runner's recent running workouts from their band. The browser saves them as runs.
export async function POST(req: Request, ctx: RouteContext<"/api/devices/[provider]/sync">) {
  const { provider: id } = await ctx.params;
  const provider = providerOf(id);
  const user = await userFrom(req);
  const db = adminClient();
  if (!provider) return Response.json({ error: "Unknown device." }, { status: 404 });
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });
  if (!db) return Response.json({ error: "The server has no SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  const saved = await loadTokens(user.id, provider.id);
  if (!saved) return Response.json({ error: `${provider.name} is not connected.` }, { status: 404 });

  try {
    let tokens = saved.tokens;
    // Short-lived tokens are renewed first, and the new ones are saved at once (an old refresh token stops working).
    if (provider.refresh && tokens.refreshToken && tokens.expiresAt && Date.parse(tokens.expiresAt) - Date.now() < 60000) {
      tokens = await provider.refresh(tokens);
      await saveTokens(user.id, provider.id, tokens);
    }
    // Go back a day before the last sync so a late-uploaded workout is not missed. Saving a run twice is harmless.
    const since = saved.lastSyncedAt ? new Date(Date.parse(saved.lastSyncedAt) - 86400000) : new Date(Date.now() - FIRST_SYNC_DAYS * 86400000);
    const imported = await provider.fetchRuns(tokens, since.toISOString());
    await db.from("device_connections").update({ last_synced_at: new Date().toISOString() }).eq("user_id", user.id).eq("provider", provider.id);
    return Response.json({ runs: imported });
  } catch {
    return Response.json({ error: `Could not read your ${provider.name} workouts. Try again, or disconnect and connect again.` }, { status: 502 });
  }
}
