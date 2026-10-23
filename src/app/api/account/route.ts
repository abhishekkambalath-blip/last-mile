import { PROVIDERS, type ProviderId } from "@/lib/devices/providers";
import { loadTokens } from "@/lib/devices/store";
import { adminClient, userFrom } from "@/lib/supabase";

// Deletes the signed-in runner's account and everything saved for it (the tables delete their rows with the user).
export async function DELETE(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });
  const admin = adminClient();
  if (!admin) return Response.json({ error: "The server has no SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  // Ask each connected band to stop sharing before the tokens are gone (best effort).
  await Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async (id) => {
      try {
        const saved = await loadTokens(user.id, id);
        if (saved && PROVIDERS[id].revoke) await PROVIDERS[id].revoke!(saved.tokens);
      } catch {}
    }),
  );

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: "We could not delete your account. Please try again." }, { status: 500 });
  return Response.json({ ok: true });
}
