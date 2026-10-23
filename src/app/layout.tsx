import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Last Mile",
  description: "A personal running plan that adapts to you",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-void text-ink">
        <AppHeader />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
