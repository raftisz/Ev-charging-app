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

export type PromptPayQrDTO = {
  payload: string;
  amount: number;
  /** Masked, e.g. "xxxxxx5678". */
  recipient: string;
  /** True when PROMPTPAY_ID is unset and a number no bank accepts is used. */
  isDemoRecipient: boolean;
};

/** A PromptPay payment waiting for the payer to confirm the transfer. */
export type PendingPromptPay = { payment: PaymentDTO; promptpay: PromptPayQrDTO };

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
  /** Path of the station photo under /public, or null to draw the gradient. */
  imageUrl: string | null;
  /** Hue of the fallback gradient. */
  imageHue: number;
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
  /** What the car is drawing right now (kW); 0 once the session has ended. */
  currentKw: number;
  /** Battery size the projection uses, for drawing the charge curve. */
  batteryKwh: number;
  station: { id: number; name: string; address: string };
  charger: { id: number; chargerCode: string; powerKw: number };
  user?: { id: number; fullName: string; email: string };
  /** The settled charge's payment, which is also its receipt. */
  receiptId: number | null;
};

export type ReceiptDTO = {
  receiptNo: string;
  payment: PaymentDTO;
  customer: { id: number; fullName: string; email: string };
  session: {
    id: number;
    stationName: string;
    stationAddress: string;
    chargerCode: string;
    startTime: string;
    endTime: string | null;
    energyKwh: number;
    pricePerKwh: number;
  } | null;
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

/** What /api/live pushes for a driver: their active session, if any. */
export type DriverSnapshot = { scope: "driver"; at: string; session: SessionDTO | null };

/** What /api/live pushes for staff: every active session in the network. */
export type NetworkSnapshot = {
  scope: "network";
  at: string;
  sessions: SessionDTO[];
  availableChargers: number;
  totalChargers: number;
  /** Sum of what every active session is drawing right now. */
  networkKw: number;
};

export type LiveSnapshot = DriverSnapshot | NetworkSnapshot;

export type PowerClass = "ac" | "dc" | "fast";

export type AnalyticsTotals = {
  sessions: number;
  energyKwh: number;
  revenue: number;
  avgKwh: number;
  avgMinutes: number;
  avgRevenue: number;
  drivers: number;
  /** Share of all charger time spent charging, in percent. */
  utilisation: number;
};

export type AnalyticsDTO = {
  days: number;
  from: string;
  to: string;
  totals: AnalyticsTotals;
  /** The same figures for the period just before, for comparison. */
  previous: AnalyticsTotals;
  daily: { date: string; sessions: number; energyKwh: number; revenue: number }[];
  /** Sessions started, [weekday Monday-first][hour 0–23], Bangkok time. */
  heatmap: number[][];
  stations: {
    id: number;
    name: string;
    chargers: number;
    sessions: number;
    energyKwh: number;
    revenue: number;
    utilisation: number;
  }[];
  powerClasses: { key: PowerClass; sessions: number; energyKwh: number }[];
  paymentMethods: { method: PaymentMethodCode; count: number; amount: number }[];
};
