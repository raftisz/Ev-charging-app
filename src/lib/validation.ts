import { z } from "zod";
import { thb } from "@/lib/format";
import { METHOD_FROM_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/payments";

const paymentMethod = z
  .enum([...PAYMENT_METHODS, ...PAYMENT_METHODS.map((m) => PAYMENT_METHOD_LABEL[m])] as [
    string,
    ...string[],
  ])
  .transform((v) => METHOD_FROM_LABEL[v] ?? (v as (typeof PAYMENT_METHODS)[number]));

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().min(6, "Enter a valid phone number").optional().or(z.literal("")),
  password: z.string().min(8, "Use at least 8 characters"),
  vehicleMake: z.string().trim().optional().or(z.literal("")),
  vehicleModel: z.string().trim().optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional().or(z.literal("")),
  vehicleMake: z.string().trim().optional().or(z.literal("")),
  vehicleModel: z.string().trim().optional().or(z.literal("")),
  vehiclePlate: z.string().trim().optional().or(z.literal("")),
  batteryKwh: z.coerce.number().min(10).max(250).optional(),
  password: z.string().min(8, "Use at least 8 characters").optional().or(z.literal("")),
});

export const reservationSchema = z.object({
  stationId: z.coerce.number().int().positive(),
  chargerId: z.coerce.number().int().positive(),
  startTime: z.string().min(1, "Pick a start time"),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  note: z.string().trim().max(240).optional().or(z.literal("")),
});

export const startSessionSchema = z.object({
  stationId: z.coerce.number().int().positive(),
  chargerId: z.coerce.number().int().positive(),
  reservationId: z.coerce.number().int().positive().optional(),
  startPercent: z.coerce.number().int().min(0).max(99).default(25),
  targetPercent: z.coerce.number().int().min(20).max(100).default(80),
});

export const paySessionSchema = z.object({
  paymentMethod,
});

export const TOP_UP_MIN = 20;
export const TOP_UP_MAX = 10_000;

export const topUpSchema = z.object({
  amount: z.coerce
    .number()
    .min(TOP_UP_MIN, `Top up at least ${thb(TOP_UP_MIN)}`)
    .max(TOP_UP_MAX, `Top up at most ${thb(TOP_UP_MAX)} at a time`),
  method: z.enum(["CREDIT_CARD", "PROMPTPAY"]),
});

const stationStatus = z.enum(["AVAILABLE", "BUSY", "OFFLINE", "MAINTENANCE"]);

export const stationCreateSchema = z.object({
  name: z.string().trim().min(2, "Station needs a name"),
  address: z.string().trim().min(4, "Station needs an address"),
  city: z.string().trim().default("Bangkok"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  operator: z.string().trim().default("Volt Grid"),
  status: stationStatus.default("AVAILABLE"),
  openingHours: z.string().trim().default("24 Hours"),
  pricePerKwh: z.coerce.number().min(0.5).max(100),
  rating: z.coerce.number().min(0).max(5).default(4.5),
  amenities: z.string().trim().default(""),
});

export const stationUpdateSchema = stationCreateSchema.partial();

export const chargerCreateSchema = z.object({
  stationId: z.coerce.number().int().positive(),
  chargerCode: z.string().trim().min(1, "Charger needs a code"),
  powerKw: z.coerce.number().min(3).max(400),
  connectorType: z.enum(["CCS2", "TYPE2", "CHADEMO"]),
  status: z
    .enum(["AVAILABLE", "CHARGING", "RESERVED", "OFFLINE", "MAINTENANCE"])
    .default("AVAILABLE"),
});

export const chargerUpdateSchema = chargerCreateSchema.partial().omit({ stationId: true });

export const userUpdateSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  role: z.enum(["USER", "OPERATOR", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  walletBalance: z.coerce.number().min(0).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
