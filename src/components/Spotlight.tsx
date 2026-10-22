"use client";

import { useEffect } from "react";

/** Tells the glass card under the cursor where the pointer is, so its lime spotlight can follow. */
export default function Spotlight() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest<HTMLElement>(".bg-elevated");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX - r.left}px`);
      card.style.setProperty("--y", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", move);
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return null;
}
