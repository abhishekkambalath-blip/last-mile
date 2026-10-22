"use client";

import Link from "next/link";
import BottomTabs from "@/components/BottomTabs";
import TrainingPlanView from "@/components/TrainingPlanView";
import { useSaved } from "@/lib/store";

export default function PlanPage() {
  const { saved, ready } = useSaved();
  const plan = saved?.plan;

  return (
    <div className="flex flex-1 justify-center px-4 pb-28 pt-6">
      <main className="w-full max-w-3xl">
        {!ready && <div className="h-96 animate-pulse rounded-xl bg-elevated" />}

        {ready && !(saved && plan) && (
          <div className="mx-auto max-w-md space-y-4 rounded-xl border border-line bg-elevated p-8 text-center">
            <h1 className="font-athletic text-3xl font-bold uppercase tracking-widest">No plan yet</h1>
            <p className="text-subtext">Tell us about your race and we&apos;ll build your first two weeks.</p>
            <Link
              href="/"
              className="inline-block rounded-md bg-volt px-5 py-2.5 font-athletic text-base font-semibold uppercase tracking-widest text-void hover:brightness-110"
            >
              Build my plan
            </Link>
          </div>
        )}

        {ready && saved && plan && <TrainingPlanView plan={plan} profile={saved.profile} />}
      </main>
      <BottomTabs />
    </div>
  );
}
