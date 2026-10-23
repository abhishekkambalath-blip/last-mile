"use client";

import { useState } from "react";
import { authInput } from "@/components/AuthShell";

/** A password box with a Show / Hide button. */
export default function PasswordInput({ value, onChange, label, autoComplete, placeholder }: { value: string; onChange: (v: string) => void; label: string; autoComplete: "new-password" | "current-password"; placeholder?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-label={label} placeholder={placeholder ?? label} className={`${authInput} pr-20`} />
      <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full px-3 text-sm font-bold text-subtext hover:text-ink">
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
