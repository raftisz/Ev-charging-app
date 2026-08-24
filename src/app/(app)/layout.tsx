import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { serializeUser } from "@/server/users";
import { SessionProvider } from "@/components/layout/SessionProvider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <SessionProvider initialUser={serializeUser(user)}>{children}</SessionProvider>
  );
}
