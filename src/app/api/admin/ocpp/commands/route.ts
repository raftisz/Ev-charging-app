import { NextResponse } from "next/server";
import { conflict, forbidden, handler, notFound, requireAdmin, HttpError } from "@/server/http";
import { prisma } from "@/server/db";
import { ocppCommandSchema } from "@/lib/validation";
import { isOcppOnline } from "@/lib/ocpp";
import { sendCommand } from "@/server/ocpp/commands";

export const dynamic = "force-dynamic";

const COMMANDS = {
  "reset-soft": ["Reset", { type: "Soft" }],
  "reset-hard": ["Reset", { type: "Hard" }],
  available: ["ChangeAvailability", { connectorId: 0, type: "Operative" }],
  unavailable: ["ChangeAvailability", { connectorId: 0, type: "Inoperative" }],
  "trigger-status": ["TriggerMessage", { requestedMessage: "StatusNotification", connectorId: 1 }],
} as const;

/** POST /api/admin/ocpp/commands — send a connected charger a command (admins only). */
export const POST = handler(async (request: Request) => {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") throw forbidden("Admin access only");
  const body = ocppCommandSchema.parse(await request.json());

  const charger = await prisma.charger.findUnique({ where: { id: body.chargerId } });
  if (!charger?.ocppIdentity) throw notFound("That charger does not exist");
  if (!isOcppOnline(charger.ocppLastSeen)) throw conflict("That charger is not connected");

  const [action, payload] = COMMANDS[body.command];
  const sent = await sendCommand(charger.ocppIdentity, action, payload);
  if (!sent.ok) throw new HttpError(sent.status === 504 ? 504 : 502, "The charger did not answer the command");
  return NextResponse.json({ action, response: sent.response });
});
