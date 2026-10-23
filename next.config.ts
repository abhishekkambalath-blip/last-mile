import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The app link opens the sign-in page, and signing in leads to a blank new-plan form (see AuthGate). Saved plans stay in
  // the Plan tab until a new one is built. With no Supabase set up there are no accounts, so the link goes straight to the form.
  async redirects() {
    const accounts = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    return [{ source: "/", destination: accounts ? "/signin" : "/new", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
