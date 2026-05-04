import type { Metadata } from "next";
import { DM_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

export const metadata: Metadata = {
  title: "bug-pilot",
  description: "QA auto-fix dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
