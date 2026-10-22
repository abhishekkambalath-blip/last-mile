"use client";

import { useRouter } from "next/navigation";
import PlanForm from "@/components/PlanForm";
import { useAccount } from "@/lib/account";
import { useSaved } from "@/lib/store";

/**
 * Where the app link lands: always a blank new-plan form. A runner's saved plan is only replaced
 * when they finish a new one, and "Cancel" takes them back to the plan they already have.
 */
export default function NewPlanPage() {
  const router = useRouter();
  const account = useAccount();
  const { saved, ready } = useSaved();

  if (!ready)
    return (
      <div className="flex flex-1 justify-center px-4 pb-44 pt-5">
        <div className="h-96 w-full max-w-3xl animate-pulse rounded-3xl bg-elevated" />
      </div>
    );

  return <PlanForm initial={null} injuryDefault={account.injury} onCancel={saved?.plan ? () => router.push("/plan") : undefined} onDone={() => router.replace("/plan")} />;
}
