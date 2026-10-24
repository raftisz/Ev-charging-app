import { NextResponse } from "next/server";
import { badRequest, handler, intParam, requireAdmin } from "@/server/http";
import { ANALYTICS_PERIODS, getAnalytics, type AnalyticsPeriod } from "@/server/analytics";

export const dynamic = "force-dynamic";

/** GET /api/admin/analytics?days=7|30|90 — network analytics for staff. */
export const GET = handler(async (request: Request) => {
  await requireAdmin();
  const days = intParam(new URL(request.url).searchParams.get("days"), 1, 365, "days") ?? 30;
  if (!(ANALYTICS_PERIODS as readonly number[]).includes(days)) {
    throw badRequest(`days must be one of: ${ANALYTICS_PERIODS.join(", ")}`);
  }
  return NextResponse.json(await getAnalytics(days as AnalyticsPeriod));
});
