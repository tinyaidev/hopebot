import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Noahide Indiana",
    template: "%s | Noahide Indiana",
  },
  description:
    "Connecting Noahides across Indiana — events, teachings, and community for those walking the path of the Seven Laws.",
  openGraph: {
    title: "Noahide Indiana",
    description:
      "Connecting Noahides across Indiana — events, teachings, and community.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
