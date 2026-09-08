import type { Metadata } from "next";
import { Suspense } from "react";
import { DrillDownProvider } from "@/components/ui/DrillDown";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "AgenCFO Agency Template 4.2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DrillDownProvider>
          <header className="sticky top-0 z-50">
            <Suspense fallback={<div className="h-[74px]" />}>
              <Nav />
            </Suspense>
          </header>
          {children}
        </DrillDownProvider>
      </body>
    </html>
  );
}
