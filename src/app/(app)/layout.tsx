import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { serializeUser } from "@/server/users";
import { SessionProvider } from "@/components/layout/SessionProvider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Not `/login`: the cookie may still hold a valid token for an account that
  // no longer exists, and the proxy would bounce it straight back here.
  if (!user) redirect("/session-expired");

  return (
    <SessionProvider initialUser={serializeUser(user)}>{children}</SessionProvider>
  );
}
