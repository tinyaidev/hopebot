import type { Metadata } from "next";
import "@xterm/xterm/css/xterm.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "hopebot",
  description: "Remote terminal for hopebot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">{children}</body>
    </html>
  );
}
