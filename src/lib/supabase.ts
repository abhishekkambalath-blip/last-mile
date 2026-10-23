import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase is set up. Without it the app keeps everything in this browser. */
export const backendOn = Boolean(URL && ANON);

let browser: SupabaseClient | null = null;

/** The browser client. The runner signs in with an email and password (see /signin and /signup). */
export function browserClient(): SupabaseClient | null {
  if (!backendOn) return null;
  browser ??= createClient(URL!, ANON!, { auth: { persistSession: true, autoRefreshToken: true } });
  return browser;
}

/** The signed-in runner's access token, or null when nobody is signed in (or the backend is off). */
export async function accessToken(): Promise<string | null> {
  const c = browserClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.access_token ?? null;
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

/** The runner behind a request's "Authorization: Bearer" header: a real account with a verified email, or null. */
export async function userFrom(req: Request): Promise<{ id: string; token: string; email: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !backendOn) return null;
  const { data, error } = await clientFor(token).auth.getUser(token);
  const u = data.user;
  if (error || !u || u.is_anonymous || !u.email || !u.email_confirmed_at) return null;
  return { id: u.id, token, email: u.email };
}
