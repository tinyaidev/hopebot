"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/terminal");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-4xl font-bold">hopebot</h1>
      <p className="text-gray-400">Remote terminal access</p>
      <button
        onClick={() => signIn("github", { callbackUrl: "/terminal" })}
        className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
      >
        Sign in with GitHub
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <LoginPage />
    </SessionProvider>
  );
}
