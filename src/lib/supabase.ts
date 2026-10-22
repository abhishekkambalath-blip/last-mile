import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase is set up. Without it the app keeps everything in this browser. */
export const backendOn = Boolean(URL && ANON);

let browser: SupabaseClient | null = null;

/** The browser client. Signs the runner in anonymously the first time, so every runner has their own user id. */
export function browserClient(): SupabaseClient | null {
  if (!backendOn) return null;
  browser ??= createClient(URL!, ANON!, { auth: { persistSession: true, autoRefreshToken: true } });
  return browser;
}

/** The runner's access token, signing in first when needed. Null if the backend is off or sign-in fails. */
export async function accessToken(): Promise<string | null> {
  const c = browserClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    if (data.session) return data.session.access_token;
    const { data: anon, error } = await c.auth.signInAnonymously();
    return error ? null : (anon.session?.access_token ?? null);
  } catch {
    return null;
  }
}

/** A server client that acts as the runner, so the database rules (RLS) limit it to their rows. */
export function clientFor(token: string): SupabaseClient {
  return createClient(URL!, ANON!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
}

/** A server client with full access. Only for the few writes a runner must not make themselves. */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return URL && key ? createClient(URL, key, { auth: { persistSession: false } }) : null;
}

/** Reads the runner's user id from a request's "Authorization: Bearer" header. */
export async function userFrom(req: Request): Promise<{ id: string; token: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !backendOn) return null;
  const { data, error } = await clientFor(token).auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id, token };
}
