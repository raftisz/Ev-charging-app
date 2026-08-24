import Link from "next/link";
import type { ReactNode } from "react";
import { BoltMark } from "@/components/ui/Icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center gap-2.5 px-5 py-4 lg:px-10 lg:py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BoltMark className="text-brand" />
          <span className="font-display text-[16px] font-bold tracking-[-0.01em] text-ink">
            Volt Grid
          </span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 sm:items-center">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
