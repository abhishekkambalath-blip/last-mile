import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import Navbar from "@/components/Navbar";
import Spotlight from "@/components/Spotlight";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Last Mile",
  description: "A personal running plan that adapts to you",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-void text-ink">
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="grid-bg" aria-hidden="true" />
        <Navbar />
        <Spotlight />
        {children}
      </body>
    </html>
  );
}
