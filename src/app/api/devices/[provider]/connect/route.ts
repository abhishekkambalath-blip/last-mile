import { randomBytes } from "node:crypto";
import { cryptoReady } from "@/lib/devices/crypto";
import { providerOf } from "@/lib/devices/providers";
import { redirectUri } from "@/lib/devices/redirect";
import { adminClient, userFrom } from "@/lib/supabase";

// Step 1 of connecting a band: remember who is asking, then hand back the company's login address.
export async function POST(req: Request, ctx: RouteContext<"/api/devices/[provider]/connect">) {
  const { provider: id } = await ctx.params;
  const provider = providerOf(id);
  const user = await userFrom(req);
  const db = adminClient();
  if (!provider) return Response.json({ error: "Unknown device." }, { status: 404 });
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });
  if (provider.state() !== "available") return Response.json({ error: `${provider.name} is not available on this server.` }, { status: 409 });
  if (!db || !cryptoReady()) return Response.json({ error: "The server needs SUPABASE_SERVICE_ROLE_KEY and DEVICE_TOKEN_KEY." }, { status: 503 });

  const state = randomBytes(16).toString("hex"); // proves the way back belongs to this runner (and stops forged callbacks)
  const { error } = await db.from("oauth_states").insert({ state, user_id: user.id, provider: provider.id });
  if (error) return Response.json({ error: "Could not start the connection." }, { status: 500 });
  return Response.json({ url: provider.authorizeUrl(state, redirectUri(req, provider.id)) });
}
