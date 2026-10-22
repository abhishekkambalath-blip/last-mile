import { PROVIDERS } from "@/lib/devices/providers";
import { cryptoReady } from "@/lib/devices/crypto";
import { adminClient, userFrom } from "@/lib/supabase";

// Lists every band with whether it can be connected here, and whether this runner has connected it.
export async function GET(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "Sign-in needed." }, { status: 401 });

  const db = adminClient();
  const { data } = db ? await db.from("device_connections").select("provider, last_synced_at").eq("user_id", user.id) : { data: [] };
  const ready = Boolean(db) && cryptoReady();

  return Response.json({
    ready, // false when the server is missing SUPABASE_SERVICE_ROLE_KEY or DEVICE_TOKEN_KEY
    devices: Object.values(PROVIDERS).map((p) => {
      const row = (data ?? []).find((r) => r.provider === p.id);
      return { id: p.id, name: p.name, note: p.note, state: p.state(), connected: Boolean(row), lastSyncedAt: row?.last_synced_at ?? null };
    }),
  });
}
