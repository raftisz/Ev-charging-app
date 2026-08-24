import clsx from "clsx";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("vg-skeleton rounded-xl", className)} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="vg-card space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vg-card flex items-center gap-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="vg-card space-y-2 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "◎",
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="vg-card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt font-display text-xl text-faint">
        {icon}
      </span>
      <div>
        <p className="font-display text-[15.5px] font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-faint">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <Button
          variant="tint"
          size="sm"
          href={action.href}
          onClick={action.onClick}
          className="mt-1"
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Could not load this",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[22px] bg-danger-tint px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white font-display text-lg font-bold text-danger">
        !
      </span>
      <div>
        <p className="font-display text-[15px] font-semibold text-danger-dark">{title}</p>
        {message ? (
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-danger-dark/80">
            {message}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
      {message}
    </p>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-[14px] bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger-dark"
    >
      {message}
    </div>
  );
}
