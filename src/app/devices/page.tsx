import Link from "next/link";
import ConnectedDevices from "@/components/ConnectedDevices";

export default function DevicesPage() {
  return (
    <div className="flex flex-1 flex-col pb-16">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-md items-center px-4">
          <Link href="/today" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="flex-1 pr-10 text-center text-lg font-extrabold">Connect devices</h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4">
        <ConnectedDevices />
      </main>
    </div>
  );
}
