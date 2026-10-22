"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AiAnalysisLoading from "@/components/AiAnalysisLoading";
import type { Plan } from "@/lib/plan";
import { useSaved, writeSaved } from "@/lib/store";

export default function BuildPage() {
  const router = useRouter();
  const { saved, ready } = useSaved();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  // No answers saved (e.g. someone opened /build directly): go to the form.
  useEffect(() => {
    if (ready && !saved) router.replace("/");
  }, [ready, saved, router]);

  // Ask for the plan once. The ref stops React's dev double-run from sending it twice.
  useEffect(() => {
    if (!ready || !saved || started.current) return;
    started.current = true;
    const profile = saved.profile;
    fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
        setPlan(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong."));
  }, [ready, saved]);

  const finish = useCallback(() => {
    if (!saved || !plan) return;
    writeSaved({ profile: saved.profile, plan });
    router.push("/plan");
  }, [saved, plan, router]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-10">
      <main className="w-full max-w-md">
        {error ? (
          <div className="space-y-4 rounded-xl border border-vo2/40 bg-elevated p-6 text-center">
            <h1 className="font-athletic text-2xl font-semibold uppercase tracking-widest text-ink">We hit a problem</h1>
            <p className="text-subtext">{error}</p>
            <Link
              href="/"
              className="inline-block rounded-md bg-volt px-5 py-2.5 font-athletic text-base font-semibold uppercase tracking-widest text-void hover:brightness-110"
            >
              Back to the form
            </Link>
          </div>
        ) : (
          ready && saved && <AiAnalysisLoading done={plan !== null} onFinished={finish} />
        )}
      </main>
    </div>
  );
}
