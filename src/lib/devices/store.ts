import { adminClient } from "@/lib/supabase";
import { open, seal } from "./crypto";
import type { ProviderId, Tokens } from "./providers";

/** Saved device connections. Only the server (service role) can read them. */
export async function loadTokens(userId: string, provider: ProviderId): Promise<{ tokens: Tokens; lastSyncedAt: string | null } | null> {
  const db = adminClient();
  if (!db) return null;
  const { data } = await db.from("device_connections").select("tokens, last_synced_at").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (!data) return null;
  return { tokens: JSON.parse(open(data.tokens)) as Tokens, lastSyncedAt: data.last_synced_at };
}

export async function saveTokens(userId: string, provider: ProviderId, tokens: Tokens) {
  const db = adminClient();
  if (!db) throw new Error("The server has no SUPABASE_SERVICE_ROLE_KEY.");
  const { error } = await db.from("device_connections").upsert({ user_id: userId, provider, tokens: seal(JSON.stringify(tokens)) });
  if (error) throw new Error("Could not save the connection.");
}
