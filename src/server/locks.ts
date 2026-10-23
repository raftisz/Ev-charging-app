import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Postgres transaction-scoped advisory locks. They serialise the few writes
 * that must check-then-act (booking a slot, starting a session) without
 * locking whole tables, and they are released automatically when the
 * transaction commits or rolls back.
 *
 * The first key is a namespace so a charger id and a user id never collide.
 */
const CHARGER = 1;
const USER = 2;

export async function lockCharger(tx: Prisma.TransactionClient, chargerId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHARGER}::int, ${chargerId}::int)`;
}

export async function lockUser(tx: Prisma.TransactionClient, userId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER}::int, ${userId}::int)`;
}
