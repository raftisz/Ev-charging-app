import { Skeleton } from "@/components/ui/States";

/**
 * Shown the instant a protected route starts loading, so signing in and moving
 * between pages paints an app-shaped frame straight away instead of leaving the
 * previous screen (or a bare spinner) on the display.
 */
export default function AppLoading() {
  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-[238px] border-r border-line bg-white p-4 lg:block">
        <Skeleton className="mb-6 h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[10px]" />
          ))}
        </div>
      </aside>

      <div className="lg:pl-[238px]">
        <header className="flex h-[62px] items-center gap-3 border-b border-line bg-white px-4 lg:h-[68px] lg:px-6">
          <Skeleton className="h-9 w-9 rounded-xl lg:hidden" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-[38px] w-[38px] rounded-[11px]" />
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pt-4 pb-28 lg:px-6 lg:pt-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="min-w-0 space-y-4">
              <Skeleton className="h-44 rounded-[22px]" />
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-[18px]" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-[18px]" />
            </div>
            <div className="hidden min-w-0 space-y-3.5 lg:block">
              <Skeleton className="h-[76px] rounded-[18px]" />
              <Skeleton className="h-40 rounded-[18px]" />
              <Skeleton className="h-56 rounded-[18px]" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
