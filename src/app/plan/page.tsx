"use client";

import { useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import PlanForm from "@/components/PlanForm";
import TrainingPlanView from "@/components/TrainingPlanView";
import { useAccount } from "@/lib/account";
import { planStart } from "@/lib/sessions";
import { useSaved } from "@/lib/store";

export default function PlanPage() {
  const { saved, ready } = useSaved();
  const [editing, setEditing] = useState(false);
  const account = useAccount();
  const plan = saved?.plan;

  if (!ready)
    return (
      <div className="flex flex-1 justify-center px-4 pb-44 pt-5">
        <div className="h-96 w-full max-w-3xl animate-pulse rounded-3xl bg-elevated" />
      </div>
    );

  // No plan yet, or the runner chose to recalibrate: show the plan form.
  if (!saved || !plan || editing)
    return <PlanForm initial={saved?.profile ?? null} injuryDefault={account.injury} onCancel={plan ? () => setEditing(false) : undefined} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-1 justify-center px-4 pb-44 pt-5">
      <main className="w-full max-w-3xl">
        <TrainingPlanView plan={plan} profile={saved.profile} start={planStart(saved.createdAt)} onRecalibrate={() => setEditing(true)} />
      </main>
      <BottomTabs />
    </div>
  );
}
