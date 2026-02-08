import type { Request } from "partykit/server";

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

function isSessionValid(user: User | undefined | null): boolean {
  return !!user?.email || !!user?.name;
}

export async function getNextAuthSession(
  proxiedRequest: Request
): Promise<User | null> {
  const origin = proxiedRequest.headers.get("origin") ?? "";
  const cookie = proxiedRequest.headers.get("cookie") ?? "";

  if (!origin || !cookie) return null;

  const res = await fetch(`${origin}/api/auth/session`, {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
    },
  });

  if (res.ok) {
    const session = await res.json();
    if (isSessionValid(session?.user)) {
      return session.user;
    }
  }

  return null;
}
