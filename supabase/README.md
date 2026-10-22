# Backend setup (Supabase)

1. Create a free project at supabase.com.
2. Authentication > Sign In / Providers > turn on **Allow anonymous sign-ins**.
3. SQL Editor > paste `schema.sql` > Run.
4. Project settings > API: copy the Project URL, the `anon` key and the `service_role` key into `.env`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Restart `npm run dev`. On Vercel, add the same three variables.

Without these keys the app keeps working from browser storage only.

## Fitness bands (Profile > Connected devices)

Needs the Supabase setup above, plus:

1. Add `DEVICE_TOKEN_KEY` to `.env` (make one with `openssl rand -hex 32`). Band tokens are encrypted with it.
2. Set `APP_URL` to the address people use (for example `https://your-app.vercel.app`; locally `http://localhost:3000`).
3. **WHOOP**: create an app at developer.whoop.com, register the redirect URL `<APP_URL>/api/devices/whoop/callback`, request the scopes `offline` and `read:workout`, and put the keys in `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`.
4. **Polar**: register a client at admin.polaraccesslink.com with the redirect URL `<APP_URL>/api/devices/polar/callback`, and put the keys in `POLAR_CLIENT_ID` and `POLAR_CLIENT_SECRET`.
5. **COROS**: the multi-user API is only for approved partners (apply at api@coros.com). It shows as "Coming soon" until its connection is written.
6. Run the new tables in `schema.sql` again (`device_connections`, `oauth_states`).

Syncing is manual ("Sync now"): it reads the last 30 days the first time, then everything since the last sync. Runs get a fixed id per workout, so syncing twice never creates duplicates. Automatic updates (webhooks) are not built.
