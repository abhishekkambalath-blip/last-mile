# Backend setup (Supabase)

1. Create a free project at supabase.com.
2. Authentication > Sign In / Providers > **Email**: turn on "Confirm email". Leave "Allow anonymous sign-ins" **off**: runners now sign up with an email and password.
3. SQL Editor > paste `schema.sql` > Run.
4. Project settings > API: copy the Project URL, the `anon` key and the `service_role` key into `.env`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Restart `npm run dev`. On Vercel, add the same three variables.

Without these keys the app keeps working from browser storage only.

## Fitness bands (profile menu > Connect devices)

Needs the Supabase setup above, plus:

1. Add `DEVICE_TOKEN_KEY` to `.env` (make one with `openssl rand -hex 32`). Band tokens are encrypted with it.
2. Set `APP_URL` to the address people use (for example `https://your-app.vercel.app`; locally `http://localhost:3000`).
3. **WHOOP**: create an app at developer.whoop.com, register the redirect URL `<APP_URL>/api/devices/whoop/callback`, request the scopes `offline` and `read:workout`, and put the keys in `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`.
4. **Polar**: register a client at admin.polaraccesslink.com with the redirect URL `<APP_URL>/api/devices/polar/callback`, and put the keys in `POLAR_CLIENT_ID` and `POLAR_CLIENT_SECRET`.
5. **Strava**: create an app at strava.com/settings/api, set its **Authorization Callback Domain** to your app address without `https://` (locally `localhost`), and put the keys in `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`. Garmin, COROS, Apple Watch and other bands that sync to Strava arrive through it.
6. **COROS**: the multi-user API is only for approved partners (apply at api@coros.com). It shows as "Coming soon" until its connection is written.
7. Run `schema.sql` again (safe to repeat): it adds the device tables and allows Strava.

Syncing is manual ("Sync now"): it reads the last 30 days the first time, then everything since the last sync. Runs get a fixed id per workout, so syncing twice never creates duplicates. Automatic updates (webhooks) are not built.

## Sign up and sign in

The app now needs an account when Supabase is on (without Supabase it still works for one person in one browser).

1. Authentication > **URL Configuration**: set **Site URL** to your app address (locally `http://localhost:3000`) and add `<app address>/reset` and `<app address>/verify` under **Redirect URLs**.
2. Authentication > **Emails > Templates > Confirm signup**: make sure the message shows the code with `{{ .Token }}` (the app asks for the 6-digit code). Do the same for **Reset password** if you also want a code there; the app uses its link.
3. Authentication > **Sign In / Providers > Email**: set the minimum password length to 8 or more.
4. The built-in email sender is limited to a few emails an hour. For real users, add your own SMTP server (Authentication > **SMTP Settings**).

How it works: sign up creates the account and emails a code; entering it verifies the email and signs the runner in. Sessions last across reloads and refresh by themselves. Every server route checks the runner's token and refuses guests and unverified emails. "Delete my account" in the profile deletes the account and all of its data. Signing out removes the runner's data from that browser.

The same steps, with your exact addresses, are shown in the app under profile menu > Connect devices > How to connect.
