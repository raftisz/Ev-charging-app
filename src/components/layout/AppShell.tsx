"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { thb } from "@/lib/format";
import type { UserDTO } from "@/lib/types";
import { BellIcon, BoltMark, MenuIcon, SearchIcon } from "@/components/ui/Icons";
import { DRIVER_NAV, DRIVER_TABS, ADMIN_NAV, isActive, type NavItem } from "@/components/layout/nav";
import { useToast } from "@/components/ui/Toast";

export function AppShell({
  user,
  title,
  subtitle,
  children,
  variant = "driver",
  unread = 0,
  action,
}: {
  user: UserDTO;
  title: string;
  subtitle?: string;
  children: ReactNode;
  variant?: "driver" | "admin";
  unread?: number;
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const nav = variant === "admin" ? ADMIN_NAV : DRIVER_NAV;
  const isAdmin = user.role === "ADMIN" || user.role === "OPERATOR";

  async function signOut() {
    setSigningOut(true);
    try {
      await api.logout();
      toast.push("Signed out", "info");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.push("Could not sign out. Try again.", "error");
      setSigningOut(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-white px-3.5 py-5">
      <Link href={variant === "admin" ? "/admin" : "/dashboard"} className="flex items-center gap-2.5 px-2 pb-5">
        <BoltMark className="text-brand" />
        <span className="font-display text-[16px] font-bold tracking-[-0.01em] text-ink">
          Volt Grid
        </span>
        {variant === "admin" ? (
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            ADMIN
          </span>
        ) : null}
      </Link>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
        ))}
      </nav>

      <div className="flex-1" />

      {variant === "driver" ? (
        <Link
          href="/history"
          className="mb-3 block rounded-[14px] bg-grid-green p-3.5 text-white transition-opacity hover:opacity-95"
        >
          <div className="text-[12px] text-grid-green-pale">Wallet balance</div>
          <div className="font-display text-[20px] font-bold">{thb(user.walletBalance)}</div>
          <div className="mt-2 text-[11.5px] font-semibold text-grid-green-pale">
            View payments →
          </div>
        </Link>
      ) : null}

      {isAdmin ? (
        <Link
          href={variant === "admin" ? "/dashboard" : "/admin"}
          className="mb-3 flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-tint"
        >
          {variant === "admin" ? "Driver app" : "Admin console"}
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      <div className="flex items-center gap-2.5 rounded-xl border border-line p-2">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">{user.fullName}</div>
          <div className="truncate text-[11.5px] text-faint">{user.email}</div>
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
          className="rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:bg-surface-alt hover:text-danger disabled:opacity-50"
        >
          Exit
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[238px] border-r border-line lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawer(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[262px] shadow-2xl"
            onClick={() => setDrawer(false)}
          >
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[238px]">
        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:h-[68px] lg:px-6">
          <button
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-xl text-ink lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[16px] font-semibold tracking-[-0.01em] text-ink lg:text-[17px]">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-[12px] text-faint lg:text-[12.5px]">{subtitle}</p>
            ) : null}
          </div>

          {action}

          <Link
            href="/stations"
            className="hidden h-[38px] w-[300px] items-center gap-2.5 rounded-[11px] border border-line bg-surface px-3 text-[13.5px] text-faint transition-colors hover:border-faint-soft xl:flex"
          >
            <SearchIcon />
            Search stations, sessions, payments
          </Link>

          <Link
            href="/notifications"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-line bg-white text-ink transition-colors hover:bg-surface-alt"
          >
            <BellIcon size={16} />
            {unread > 0 ? (
              <span className="absolute top-[7px] right-[8px] h-[7px] w-[7px] rounded-full border-2 border-white bg-danger" />
            ) : null}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pt-4 pb-28 lg:px-6 lg:pt-6 lg:pb-10">
          {children}
        </main>
      </div>

      {variant === "driver" ? <TabBar pathname={pathname} /> : null}
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex min-h-10 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 transition-colors",
        active ? "bg-brand-tint text-brand" : "text-ink-soft hover:bg-surface-alt",
      )}
    >
      <span className="w-5 text-center font-display text-[13px] font-bold" aria-hidden>
        {item.glyph}
      </span>
      <span className={clsx("text-[14px]", active ? "font-semibold" : "font-medium")}>
        {item.label}
      </span>
    </Link>
  );
}

export function Avatar({ user, size = 32 }: { user: UserDTO; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-tint font-display font-semibold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {user.avatarInit}
    </span>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),14px)] backdrop-blur lg:hidden">
      {DRIVER_TABS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 flex-col items-center gap-1 py-1.5"
          >
            <span
              className={clsx(
                "font-display text-[13px] font-bold",
                active ? "text-brand" : "text-faint-soft",
              )}
              aria-hidden
            >
              {item.glyph}
            </span>
            <span
              className={clsx(
                "text-[10.5px] font-semibold",
                active ? "text-brand" : "text-faint-soft",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
