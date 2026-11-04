import type { Metadata } from "next";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turan Math",
  description: "SAT Math practice in a Bluebook-style testing environment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
