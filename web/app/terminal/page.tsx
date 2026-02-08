"use client";

import { useSession, SessionProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";

const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

function TerminalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="h-screen w-screen flex flex-col">
      <Terminal />
    </div>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <TerminalPage />
    </SessionProvider>
  );
}
