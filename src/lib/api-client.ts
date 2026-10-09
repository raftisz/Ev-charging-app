import type {
  AdminStats,
  ApiError,
  DashboardStats,
  NotificationDTO,
  PaymentDTO,
  ReservationDTO,
  SessionDTO,
  StationDTO,
  StationDetailDTO,
  UserDTO,
} from "@/lib/types";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiRequestError(0, "Cannot reach the server. Check your connection.");
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const err = (payload ?? {}) as ApiError;
    throw new ApiRequestError(
      response.status,
      err.error ?? "Request failed",
      err.details,
    );
  }
  return payload as T;
}

const get = <T,>(path: string) => request<T>(path, { method: "GET", cache: "no-store" });
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
const del = <T,>(path: string) => request<T>(path, { method: "DELETE" });

export function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export type DashboardPayload = {
  stats: DashboardStats;
  activeSession: SessionDTO | null;
  recommended: StationDTO[];
  recentSessions: SessionDTO[];
  nextReservation: ReservationDTO | null;
  unreadNotifications: number;
};

export type AdminPayload = {
  stats: AdminStats;
  activeSessions: SessionDTO[];
  recentSessions: SessionDTO[];
  upcomingReservations: ReservationDTO[];
};

export type AvailabilityPayload = {
  date: string;
  durationMinutes: number;
  chargers: {
    id: number;
    chargerCode: string;
    powerKw: number;
    status: string;
    bookable: boolean;
    slots: { time: string; iso: string; available: boolean; reason?: string }[];
  }[];
};

export const api = {
  register: (body: unknown) => post<{ user: UserDTO }>("/api/auth/register", body),
  login: (body: unknown) => post<{ user: UserDTO }>("/api/auth/login", body),
  logout: () => post<{ ok: true }>("/api/auth/logout"),
  me: () => get<{ user: UserDTO | null }>("/api/auth/me"),

  dashboard: () => get<DashboardPayload>("/api/dashboard"),
  adminStats: () => get<AdminPayload>("/api/admin/stats"),

  stations: (params: Record<string, string | number | boolean | undefined> = {}) =>
    get<{ stations: StationDTO[]; total: number }>(`/api/stations${query(params)}`),
  station: (id: number) => get<{ station: StationDetailDTO }>(`/api/stations/${id}`),
  createStation: (body: unknown) => post<{ station: StationDetailDTO }>("/api/stations", body),
  updateStation: (id: number, body: unknown) =>
    patch<{ station: StationDetailDTO }>(`/api/stations/${id}`, body),
  deleteStation: (id: number) => del<{ ok: true }>(`/api/stations/${id}`),
  availability: (id: number, date: string, duration: number) =>
    get<AvailabilityPayload>(`/api/stations/${id}/availability${query({ date, duration })}`),

  favorites: () => get<{ stations: StationDTO[] }>("/api/favorites"),
  addFavorite: (id: number) => post<{ isFavorite: boolean }>(`/api/stations/${id}/favorite`),
  removeFavorite: (id: number) => del<{ isFavorite: boolean }>(`/api/stations/${id}/favorite`),

  reservations: (params: Record<string, string | boolean | undefined> = {}) =>
    get<{ reservations: ReservationDTO[] }>(`/api/reservations${query(params)}`),
  createReservation: (body: unknown) =>
    post<{ reservation: ReservationDTO }>("/api/reservations", body),
  updateReservation: (id: number, status: string) =>
    patch<{ reservation: ReservationDTO }>(`/api/reservations/${id}`, { status }),

  sessions: (params: Record<string, string | number | boolean | undefined> = {}) =>
    get<{ sessions: SessionDTO[] }>(`/api/charging-sessions${query(params)}`),
  session: (id: number) => get<{ session: SessionDTO }>(`/api/charging-sessions/${id}`),
  startSession: (body: unknown) =>
    post<{ session: SessionDTO }>("/api/charging-sessions", body),
  stopSession: (id: number) =>
    patch<{ session: SessionDTO }>(`/api/charging-sessions/${id}`, { action: "stop" }),
  paySession: (id: number, paymentMethod: string) =>
    patch<{ session: SessionDTO }>(`/api/charging-sessions/${id}`, {
      action: "pay",
      paymentMethod,
    }),

  wallet: () => get<{ balance: number; transactions: PaymentDTO[] }>("/api/wallet"),
  topUp: (amount: number, method: string) =>
    post<{ balance: number; payment: PaymentDTO }>("/api/wallet/topup", { amount, method }),

  notifications: () =>
    get<{ notifications: NotificationDTO[]; unread: number }>("/api/notifications"),
  readAllNotifications: () => patch<{ ok: true }>("/api/notifications"),
  readNotification: (id: number) => patch<unknown>(`/api/notifications/${id}`),

  profile: () => get<{ user: UserDTO }>("/api/profile"),
  updateProfile: (body: unknown) => patch<{ user: UserDTO }>("/api/profile", body),

  users: (q?: string) =>
    get<{ users: (UserDTO & { sessionCount: number; reservationCount: number })[] }>(
      `/api/users${query({ q })}`,
    ),
  updateUser: (id: number, body: unknown) => patch<{ user: UserDTO }>(`/api/users/${id}`, body),
  deleteUser: (id: number) => del<{ ok: true }>(`/api/users/${id}`),

  chargers: (params: Record<string, string | number | undefined> = {}) =>
    get<{
      chargers: {
        id: number;
        chargerCode: string;
        status: string;
        powerKw: number;
        station: { id: number; name: string };
        connectors: { id: number; type: string; label: string; powerKw: number }[];
      }[];
    }>(`/api/chargers${query(params)}`),
  createCharger: (body: unknown) => post<unknown>("/api/chargers", body),
  updateCharger: (id: number, body: unknown) => patch<unknown>(`/api/chargers/${id}`, body),
  deleteCharger: (id: number) => del<{ ok: true }>(`/api/chargers/${id}`),
};
