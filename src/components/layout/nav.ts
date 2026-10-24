import type { Messages } from "@/i18n/messages";

type NavMessages = Messages["nav"];
type NavLabel = {
  [K in keyof NavMessages]: NavMessages[K] extends string ? K : never;
}[keyof NavMessages];

export type NavItem = {
  href: string;
  /** Key into the `nav` message group. */
  label: NavLabel;
  glyph: string;
  /** Extra path prefixes that should keep this item highlighted. */
  match?: string[];
};

export const DRIVER_NAV: NavItem[] = [
  { href: "/dashboard", label: "dashboard", glyph: "⌂" },
  { href: "/stations", label: "stationsMap", glyph: "◎", match: ["/stations", "/map"] },
  { href: "/charging", label: "charging", glyph: "⚡" },
  { href: "/reservations", label: "reservations", glyph: "▦" },
  { href: "/history", label: "historyPayments", glyph: "≡" },
  { href: "/wallet", label: "wallet", glyph: "฿" },
  { href: "/profile", label: "profile", glyph: "◍", match: ["/profile", "/settings", "/favorites"] },
];

export const DRIVER_TABS: NavItem[] = [
  { href: "/dashboard", label: "tabHome", glyph: "⌂" },
  { href: "/stations", label: "tabStations", glyph: "◎", match: ["/stations", "/map"] },
  { href: "/charging", label: "tabCharging", glyph: "⚡" },
  { href: "/history", label: "tabActivity", glyph: "≡", match: ["/history", "/reservations"] },
  { href: "/profile", label: "tabProfile", glyph: "◍", match: ["/profile", "/favorites", "/wallet"] },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "overview", glyph: "⌂" },
  { href: "/admin/stations", label: "stations", glyph: "◎" },
  { href: "/admin/chargers", label: "chargers", glyph: "⚡" },
  { href: "/admin/reservations", label: "reservations", glyph: "▦" },
  { href: "/admin/sessions", label: "sessions", glyph: "◐" },
  { href: "/admin/users", label: "users", glyph: "◍" },
];

export function isActive(pathname: string, item: NavItem) {
  const targets = item.match ?? [item.href];
  return targets.some((t) =>
    t === "/admin" ? pathname === "/admin" : pathname === t || pathname.startsWith(`${t}/`),
  );
}
