"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { startAuth, useAuth } from "@/lib/auth";

const PUBLIC = ["/signin", "/signup", "/verify", "/forgot", "/reset"];

/**
 * With the backend on, every page except the sign-in pages needs a signed-in runner.
 * With it off, the app is open and keeps everything in this browser.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.includes(path);

  useEffect(() => {
    startAuth();
  }, []);

  useEffect(() => {
    if (auth.status === "out" && !isPublic) router.replace("/signin");
    if (auth.status === "in" && (path === "/signin" || path === "/signup")) router.replace("/new");
  }, [auth.status, isPublic, path, router]);

  const waiting = auth.status === "loading" || (auth.status === "out" && !isPublic) || (auth.status === "in" && (path === "/signin" || path === "/signup"));
  if (waiting)
    return (
      <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-volt" />
      </div>
    );
  return <>{children}</>;
}
