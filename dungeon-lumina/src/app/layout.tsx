import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumina's Quest: Crystal Caverns",
  description:
    "A family-friendly 8-bit dungeon crawler. Recover the shattered Crystal Crown of Lumina across 5 perilous floors!",
  openGraph: {
    title: "Lumina's Quest: Crystal Caverns",
    description: "5 floors · 14 spells · discoverable story",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
