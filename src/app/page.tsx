import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui/Button";
import { BoltMark } from "@/components/ui/Icons";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const [stations, chargers, fastSites] = await Promise.all([
    prisma.station.count(),
    prisma.charger.count(),
    prisma.station.count({ where: { chargers: { some: { powerKw: { gte: 100 } } } } }),
  ]);

  const { m } = await getI18n();
  const t = m.landing;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center gap-2.5 px-5 py-4 lg:px-10 lg:py-6">
        <BoltMark className="text-brand" />
        <span className="font-display text-[16px] font-bold tracking-[-0.01em] text-ink">
          {m.common.appName}
        </span>
        <span className="hidden text-[12px] text-faint sm:inline">{t.network}</span>
        <div className="flex-1" />
        <LanguageSwitch />
        <Link href="/login" className="text-[13.5px] font-semibold text-brand">
          {t.signIn}
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-10 lg:px-10">
        <div className="grid w-full max-w-[1080px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.08em] text-brand uppercase">
              {t.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-[34px] leading-[1.1] font-bold tracking-[-0.02em] text-ink lg:text-[46px]">
              {t.headline1}
              <br />
              {t.headline2}
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
              {t.lead(stations, chargers)}
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Button href="/register" size="lg" className="sm:px-8">
                {t.createAccount}
              </Button>
              <Button href="/login" size="lg" variant="secondary" className="sm:px-8">
                {t.signIn}
              </Button>
            </div>

            <div className="vg-card mt-6 px-4 py-3.5 text-[12.5px] leading-relaxed text-muted">
              <span className="font-semibold text-ink">{t.demoAccounts}</span> · {t.password}{" "}
              <code className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-[11.5px]">
                password123
              </code>
              <br />
              {t.demoUsers}
              <br />
              <Link href="/login" className="font-semibold text-brand">
                {t.oneClick}
              </Link>{" "}
              · {t.resetsDaily}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-brand-tint via-white to-grid-green-tint opacity-70 blur-2xl" />
            <div className="vg-card overflow-hidden">
              <div className="relative h-40 bg-[linear-gradient(140deg,#1e3a8a,#2563eb_65%,#10b981)]">
                <svg
                  viewBox="0 0 400 160"
                  preserveAspectRatio="xMidYMid slice"
                  className="absolute inset-0 h-full w-full opacity-25"
                  aria-hidden
                >
                  <rect x="40" y="56" width="46" height="104" rx="10" fill="#fff" opacity=".5" />
                  <rect x="130" y="34" width="46" height="126" rx="10" fill="#fff" opacity=".35" />
                  <rect x="220" y="70" width="46" height="90" rx="10" fill="#fff" opacity=".45" />
                  <rect x="310" y="46" width="46" height="114" rx="10" fill="#fff" opacity=".3" />
                </svg>
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="font-display text-[22px] font-bold">{t.fastSites(fastSites)}</div>
                  <div className="text-[12.5px] text-white/80">{t.fastSitesNote}</div>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {t.points.map(([letter, title, body]) => (
                  <li key={title} className="flex gap-3.5 px-4 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-tint font-display text-[13px] font-bold text-brand">
                      {letter}
                    </span>
                    <div>
                      <div className="font-display text-[14.5px] font-semibold text-ink">
                        {title}
                      </div>
                      <div className="mt-0.5 text-[13px] leading-relaxed text-faint">{body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
