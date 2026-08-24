/**
 * Edge-safe half of the auth helpers: token verification only, no Prisma,
 * no bcrypt, so middleware can import it.
 */
import { jwtVerify } from "jose";

export const SESSION_COOKIE = "vg_session";

export type SessionPayload = {
  userId: number;
  email: string;
  role: "USER" | "OPERATOR" | "ADMIN";
};

export async function readToken(token: string): Promise<SessionPayload | null> {
  const key = process.env.JWT_SECRET;
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(key));
    if (typeof payload.userId !== "number" || typeof payload.email !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}
