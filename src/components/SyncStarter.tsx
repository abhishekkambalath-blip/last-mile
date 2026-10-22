"use client";

import { useEffect } from "react";
import { pullAll } from "@/lib/sync";

/** Starts loading the runner's saved data from the backend when the app opens. Shows nothing. */
export default function SyncStarter() {
  useEffect(() => {
    void pullAll();
  }, []);
  return null;
}
