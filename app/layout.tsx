import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Fraunces, Newsreader, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "Shannon — judgments, not bookmarks",
  description: "Shannon freezes a source, proposes judgments that quote it exactly, and keeps only what you accept.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${fraunces.variable} ${newsreader.variable} antialiased`}>{children}</body>
    </html>
  );
}
