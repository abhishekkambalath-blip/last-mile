import { loadTokens } from "@/lib/devices/store";
import { providerOf } from "@/lib/devices/providers";
import { adminClient, userFrom } from "@/lib/supabase";

// Disconnects a band: asks the company to cancel our access (best effort), then forgets the tokens.
export async function DELETE(req: Request, ctx: RouteContext<"/api/devices/[provider]">) {
  const { provider: id } = await ctx.params;
  const provider = providerOf(id);
  const user = await userFrom(req);
  const db = adminClient();
  if (!provider) return Response.json({ error: "Unknown device." }, { status: 404 });
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });
  if (!db) return Response.json({ error: "The server has no SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  try {
    const saved = await loadTokens(user.id, provider.id);
    if (saved && provider.revoke) await provider.revoke(saved.tokens).catch(() => {});
  } catch {}
  await db.from("device_connections").delete().eq("user_id", user.id).eq("provider", provider.id);
  return Response.json({ ok: true });
}
