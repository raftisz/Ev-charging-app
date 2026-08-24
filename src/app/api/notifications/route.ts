import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unread: rows.filter((n) => !n.isRead).length,
  });
});

/** Mark every notification read. */
export const PATCH = handler(async () => {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
});
