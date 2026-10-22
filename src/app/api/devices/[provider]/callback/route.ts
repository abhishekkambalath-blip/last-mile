import { cryptoReady } from "@/lib/devices/crypto";
import { providerOf } from "@/lib/devices/providers";
import { appBase, redirectUri } from "@/lib/devices/redirect";
import { saveTokens } from "@/lib/devices/store";
import { adminClient } from "@/lib/supabase";

const STATE_MINUTES = 10;

// Step 2: the company sends the runner back here with a code. Trade it for tokens and keep them (encrypted).
export async function GET(req: Request, ctx: RouteContext<"/api/devices/[provider]/callback">) {
  const { provider: id } = await ctx.params;
  const url = new URL(req.url);
  const home = appBase(req);
  const back = (q: string) => Response.redirect(`${home}/profile?${q}`, 302);

  const provider = providerOf(id);
  const db = adminClient();
  if (!provider || !db || !cryptoReady()) return back("device_error=server");
  if (url.searchParams.get("error")) return back(`device_error=denied&device=${provider.id}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back(`device_error=failed&device=${provider.id}`);

  // The state is single use. Taking it out of the table proves this callback belongs to a connection we started.
  const { data: row } = await db.from("oauth_states").delete().eq("state", state).eq("provider", provider.id).select("user_id, created_at").maybeSingle();
  if (!row || Date.now() - Date.parse(row.created_at) > STATE_MINUTES * 60000) return back(`device_error=expired&device=${provider.id}`);

  try {
    let tokens = await provider.exchange(code, redirectUri(req, provider.id));
    if (provider.afterConnect) tokens = await provider.afterConnect(tokens, row.user_id);
    await saveTokens(row.user_id, provider.id, tokens);
  } catch {
    return back(`device_error=failed&device=${provider.id}`);
  }
  return back(`device=${provider.id}`);
}
