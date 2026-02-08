import type { NextConfig } from "next";

const PARTYKIT_URL =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST?.startsWith("localhost")
    ? `http://${process.env.NEXT_PUBLIC_PARTYKIT_HOST}`
    : `https://${process.env.NEXT_PUBLIC_PARTYKIT_HOST}`;

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: "/terminal/auth",
      has: [{ type: "query", key: "_pk", value: "(?<pk>.*)" }],
      destination: `${PARTYKIT_URL}/parties/main/hopebot/auth?_pk=:pk`,
    },
  ],
};

export default nextConfig;
