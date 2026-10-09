/** Serialised shapes returned by the REST API and consumed by the UI. */

export type Role = "USER" | "OPERATOR" | "ADMIN";
export type StationStatus = "AVAILABLE" | "BUSY" | "OFFLINE" | "MAINTENANCE";
export type ChargerStatus =
  | "AVAILABLE"
  | "CHARGING"
  | "RESERVED"
  | "OFFLINE"
  | "MAINTENANCE";
export type ConnectorType = "CCS2" | "TYPE2" | "CHADEMO";
export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";
export type SessionStatus = "ACTIVE" | "COMPLETED" | "STOPPED" | "FAULTED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentType = "CHARGE" | "TOPUP" | "REFUND";
export type PaymentMethodCode = "WALLET" | "CREDIT_CARD" | "PROMPTPAY";

export type PaymentDTO = {
  id: number;
  type: PaymentType;
  amount: number;
  method: PaymentMethodCode;
  methodLabel: string;
  status: PaymentStatus;
  providerRef: string | null;
  createdAt: string;
  sessionId: number | null;
  stationName: string | null;
};

export type NotificationType = "SESSION" | "RESERVATION" | "PAYMENT" | "SYSTEM";

export type ConnectorDTO = {
  id: number;
  type: ConnectorType;
  label: string;
  powerKw: number;
};

export type ChargerDTO = {
  id: number;
  chargerCode: string;
  status: ChargerStatus;
  powerKw: number;
  connectors: ConnectorDTO[];
};

export type StationDTO = {
  id: number;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  operator: string;
  status: StationStatus;
  openingHours: string;
  pricePerKwh: number;
  rating: number;
  reviewCount: number;
  amenities: string[];
  chargerCount: number;
  availableCount: number;
  maxPowerKw: number;
  connectorTypes: ConnectorType[];
  distanceKm: number;
  etaMin: number;
  isFavorite: boolean;
  isOpen: boolean;
};

export type StationDetailDTO = StationDTO & {
  chargers: ChargerDTO[];
};

export type UserDTO = {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  avatarInit: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  batteryKwh: number | null;
  walletBalance: number;
  isActive: boolean;
  createdAt: string;
};

export type ReservationDTO = {
  id: number;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
  estimatedKwh: number;
  reservationFee: number;
  estimatedCost: number;
  station: { id: number; name: string; address: string; pricePerKwh: number };
  charger: { id: number; chargerCode: string; powerKw: number };
  user?: { id: number; fullName: string; email: string };
};

export type SessionDTO = {
  id: number;
  status: SessionStatus;
  startTime: string;
  endTime: string | null;
  startPercent: number;
  currentPercent: number;
  targetPercent: number;
  energyKwh: number;
  powerKw: number;
  pricePerKwh: number;
  cost: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  minutesElapsed: number;
  minutesToTarget: number;
  station: { id: number; name: string; address: string };
  charger: { id: number; chargerCode: string; powerKw: number };
  user?: { id: number; fullName: string; email: string };
};

export type NotificationDTO = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type DashboardStats = {
  totalStations: number;
  openStations: number;
  totalChargers: number;
  availableChargers: number;
  activeSessions: number;
  utilization: number;
  monthEnergyKwh: number;
  monthSpend: number;
  monthSessions: number;
  co2SavedKg: number;
  upcomingReservations: number;
  fastSites: number;
  dailyEnergy: { date: string; kwh: number }[];
};

export type AdminStats = {
  totalStations: number;
  totalChargers: number;
  availableChargers: number;
  activeSessions: number;
  totalUsers: number;
  activeUsers: number;
  totalEnergyKwh: number;
  revenue: number;
  revenue30d: number;
  reservations: number;
  upcomingReservations: number;
  utilization: number;
  statusBreakdown: { status: StationStatus; count: number }[];
  chargerBreakdown: { status: ChargerStatus; count: number }[];
  revenueByDay: { date: string; revenue: number; kwh: number }[];
  topStations: { id: number; name: string; sessions: number; revenue: number }[];
};

export type ApiError = { error: string; details?: unknown };
