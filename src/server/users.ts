import "server-only";
import type { UserDTO } from "@/lib/types";
import type { UserModel } from "@/generated/prisma/models";

export function serializeUser(user: UserModel): UserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    avatarInit:
      user.avatarInit ??
      user.fullName
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    vehicleMake: user.vehicleMake,
    vehicleModel: user.vehicleModel,
    vehiclePlate: user.vehiclePlate,
    batteryKwh: user.batteryKwh,
    walletBalance: user.walletBalance,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
