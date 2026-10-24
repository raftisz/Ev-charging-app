import type { Locale } from "@/i18n/config";
import { receipt } from "./receipt";
import { admin } from "./admin";
import { account } from "./account";
import { wallet } from "./wallet";
import { history } from "./history";
import { reservations } from "./reservations";
import { charging } from "./charging";
import { dashboard } from "./dashboard";
import { landing } from "./landing";
import { auth } from "./auth";
import { payments } from "./payments";
import { stations } from "./stations";
import { common } from "./common";
import { meta } from "./meta";
import { nav } from "./nav";
import { status } from "./status";

/**
 * Every message group, by language. Each group keeps its English and Thai
 * side by side (see ./common.ts) and is type-checked for matching keys.
 */
const groups = { account, admin, auth, charging, common, dashboard, history, landing, meta, nav, payments, receipt, reservations, stations, status, wallet };

type Groups = typeof groups;
export type Messages = { [K in keyof Groups]: Groups[K]["en"] };

function pick(locale: Locale): Messages {
  const out = {} as Record<string, unknown>;
  for (const [name, group] of Object.entries(groups)) {
    out[name] = group[locale];
  }
  return out as Messages;
}

export const MESSAGES: Record<Locale, Messages> = { en: pick("en"), th: pick("th") };
