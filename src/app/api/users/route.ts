import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handler, requireAdmin } from "@/server/http";
import { serializeUser } from "@/server/users";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  await requireAdmin();
  const q = new URL(request.url).searchParams.get("q")?.trim();

  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }] }
      : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { sessions: true, reservations: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      ...serializeUser(u),
      sessionCount: u._count.sessions,
      reservationCount: u._count.reservations,
    })),
  });
});
