"use client";

import clsx from "clsx";
import { Page } from "@/components/layout/Page";
import { api } from "@/lib/api-client";
import { useAsync } from "@/lib/use-async";
import { useSession } from "@/components/layout/SessionProvider";
import { relative } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import type { NotificationType } from "@/lib/types";

const TYPE_STYLE: Record<NotificationType, { glyph: string; tint: string; fg: string }> = {
  SESSION: { glyph: "⚡", tint: "bg-grid-green-tint", fg: "text-grid-green" },
  RESERVATION: { glyph: "▦", tint: "bg-brand-tint", fg: "text-brand" },
  PAYMENT: { glyph: "฿", tint: "bg-amber-tint", fg: "text-amber-dark" },
  SYSTEM: { glyph: "◉", tint: "bg-surface-alt", fg: "text-muted" },
};

export default function NotificationsPage() {
  const toast = useToast();
  const { refreshUnread } = useSession();
  const { data, loading, error, reload } = useAsync(() => api.notifications());

  async function markAll() {
    try {
      await api.readAllNotifications();
      toast.push("All notifications marked read");
      void reload(true);
      void refreshUnread();
    } catch {
      toast.push("Could not update notifications", "error");
    }
  }

  const notifications = data?.notifications ?? [];

  return (
    <Page
      title="Notifications"
      subtitle={data ? `${data.unread} unread` : undefined}
      action={
        data && data.unread > 0 ? (
          <Button size="sm" variant="secondary" onClick={markAll}>
            Mark all read
          </Button>
        ) : null
      }
    >
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <ListSkeleton count={5} /> : null}

      {data && notifications.length === 0 ? (
        <EmptyState
          icon="◉"
          title="Nothing to catch up on"
          description="Session updates, reservation reminders and payment receipts land here."
        />
      ) : null}

      {notifications.length ? (
        <ul className="space-y-2.5">
          {notifications.map((n) => {
            const style = TYPE_STYLE[n.type];
            return (
              <li
                key={n.id}
                className={clsx(
                  "vg-card flex gap-3.5 p-4",
                  !n.isRead && "border-brand/35 bg-brand-tint/25",
                )}
              >
                <span
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-[14px] font-bold",
                    style.tint,
                    style.fg,
                  )}
                  aria-hidden
                >
                  {style.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 font-display text-[14.5px] font-semibold text-ink">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-faint">
                      {relative(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.body}</p>
                </div>
                {!n.isRead ? (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Page>
  );
}
