"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/components/layout/SessionProvider";

/** Thin wrapper so pages only declare their own title and content. */
export function Page({
  title,
  subtitle,
  variant = "driver",
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  variant?: "driver" | "admin";
  action?: ReactNode;
  children: ReactNode;
}) {
  const { user, unread } = useSession();
  return (
    <AppShell
      user={user}
      title={title}
      subtitle={subtitle}
      variant={variant}
      unread={unread}
      action={action}
    >
      {children}
    </AppShell>
  );
}
