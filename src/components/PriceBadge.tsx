import { PRICE_INR } from "@/lib/plan";

/** The yearly price as a small pill, for example "₹4,999/yr". */
export function PriceBadge() {
  return (
    <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-extrabold text-void">
      ₹{PRICE_INR.toLocaleString("en-IN")}/yr
    </span>
  );
}
