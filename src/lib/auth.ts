import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE as COOKIE_NAME } from "@/lib/auth-edge";
import { ConfigError } from "@/lib/http";
import type { Role } from "@/generated/prisma/enums";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: number;
  email: string;
  role: Role;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new ConfigError(
      "JWT_SECRET is not set. Add it to the environment and redeploy.",
    );
  }
  return new TextEncoder().encode(value);
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function readToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "number" || typeof payload.email !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function startSession(payload: SessionPayload) {
  const token = await createToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readToken(token);
}

/** Session plus the freshly loaded user row, or null when signed out/disabled. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}

