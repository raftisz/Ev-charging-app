import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/server/auth";

/** The server is missing something it needs, e.g. an environment variable. */
export class ConfigError extends Error {}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = "You need to sign in first") => new HttpError(401, m);
export const forbidden = (m = "You do not have access to this resource") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

/** Wraps a route handler so thrown HttpError/ZodError become clean JSON. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse | Response>,
) {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.message, details: error.details ?? null },
          { status: error.status },
        );
      }
      if (error instanceof ConfigError) {
        console.error("[config]", error.message);
        return NextResponse.json(
          {
            error: `The server is not configured correctly: ${error.message}`,
          },
          { status: 500 },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Please check the highlighted fields",
            details: error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 422 },
        );
      }
      console.error("[api]", error);
      return NextResponse.json(
        { error: "Something went wrong on our side. Please try again." },
        { status: 500 },
      );
    }
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "OPERATOR") {
    throw forbidden("Admin access only");
  }
  return user;
}

/** A positive integer id from a route segment, or 400. */
export function parseId(raw: string, label = "id") {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label}`);
  return id;
}

/** A query value that must be one of `allowed`; absent is fine, anything else is 400. */
export function enumParam<T extends string>(
  value: string | null,
  allowed: readonly T[],
  name: string,
): T | undefined {
  if (value === null || value === "") return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw badRequest(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** An optional whole-number query value between min and max, or 400. */
export function intParam(value: string | null, min: number, max: number, name: string) {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${name} must be a whole number from ${min} to ${max}`);
  }
  return n;
}
