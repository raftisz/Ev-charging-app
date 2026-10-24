import { NextResponse } from "next/server";
import { enumParam, forbidden, handler, requireUser } from "@/server/http";
import { driverSnapshot, networkSnapshot } from "@/server/live";
import type { LiveSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";
// The stream ends itself before this and the browser reconnects (see below).
export const maxDuration = 60;

/** How often a snapshot is pushed. */
const INTERVAL_MS = 3_000;
/**
 * How long one connection stays open. Serverless hosts cap a function's run
 * time, so the server closes the stream a little before that and the
 * browser's EventSource reconnects on its own after `retry` milliseconds.
 */
const LIFETIME_MS = 50_000;

/**
 * Live charging data as Server-Sent Events.
 *
 *   GET /api/live?scope=driver    the signed-in driver's active session
 *   GET /api/live?scope=network   every active session (staff only)
 *   add &once=1 for a single JSON snapshot instead of a stream
 */
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const scope = enumParam(url.searchParams.get("scope"), ["driver", "network"] as const, "scope") ?? "driver";
  if (scope === "network" && user.role !== "ADMIN" && user.role !== "OPERATOR") {
    throw forbidden("Admin access only");
  }
  const snapshot = (): Promise<LiveSnapshot> =>
    scope === "network" ? networkSnapshot() : driverSnapshot(user.id);

  if (url.searchParams.get("once") === "1") {
    return NextResponse.json(await snapshot());
  }

  const encoder = new TextEncoder();
  const signal = request.signal;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      const startedAt = Date.now();
      send(`retry: 1000\n\n`);
      try {
        while (!signal.aborted && Date.now() - startedAt < LIFETIME_MS) {
          send(`event: snapshot\ndata: ${JSON.stringify(await snapshot())}\n\n`);
          await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
        }
      } catch (error) {
        // A closed connection makes enqueue throw; that is the visitor leaving.
        if (!signal.aborted) console.error("[live]", error);
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops proxies such as nginx from holding events back in a buffer.
      "X-Accel-Buffering": "no",
    },
  });
});
