# Backend setup (Supabase)

1. Create a free project at supabase.com.
2. Authentication > Sign In / Providers > turn on **Allow anonymous sign-ins**.
3. SQL Editor > paste `schema.sql` > Run.
4. Project settings > API: copy the Project URL, the `anon` key and the `service_role` key into `.env`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Restart `npm run dev`. On Vercel, add the same three variables.

Without these keys the app keeps working from browser storage only.
