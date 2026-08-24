export type NavItem = {
  href: string;
  label: string;
  glyph: string;
  /** Extra path prefixes that should keep this item highlighted. */
  match?: string[];
};

export const DRIVER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", glyph: "⌂" },
  { href: "/stations", label: "Stations & map", glyph: "◎", match: ["/stations", "/map"] },
  { href: "/charging", label: "Charging session", glyph: "⚡" },
  { href: "/reservations", label: "Reservations", glyph: "▦" },
  { href: "/history", label: "History & payments", glyph: "฿" },
  { href: "/profile", label: "Profile", glyph: "◍", match: ["/profile", "/settings", "/favorites"] },
];

export const DRIVER_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", glyph: "⌂" },
  { href: "/stations", label: "Stations", glyph: "◎", match: ["/stations", "/map"] },
  { href: "/charging", label: "Charging", glyph: "⚡" },
  { href: "/history", label: "Activity", glyph: "≡", match: ["/history", "/reservations"] },
  { href: "/profile", label: "Profile", glyph: "◍", match: ["/profile", "/favorites"] },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", glyph: "⌂" },
  { href: "/admin/stations", label: "Stations", glyph: "◎" },
  { href: "/admin/chargers", label: "Chargers", glyph: "⚡" },
  { href: "/admin/reservations", label: "Reservations", glyph: "▦" },
  { href: "/admin/sessions", label: "Sessions", glyph: "◐" },
  { href: "/admin/users", label: "Users", glyph: "◍" },
];

export function isActive(pathname: string, item: NavItem) {
  const targets = item.match ?? [item.href];
  return targets.some((t) =>
    t === "/admin" ? pathname === "/admin" : pathname === t || pathname.startsWith(`${t}/`),
  );
}
