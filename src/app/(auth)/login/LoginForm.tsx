"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { DEMO_PASSWORD, DEMO_RESET_TIME } from "@/lib/demo";

const DEMOS = [
  { as: "driver", label: "Driver", hint: "Live session, wallet, bookings" },
  { as: "admin", label: "Admin", hint: "Dashboard, stations, refunds" },
  { as: "operator", label: "Operator", hint: "Station management" },
] as const;

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = params.get("next") || "/dashboard";
  const expired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "Enter your email address";
    if (!password) errors.password = "Enter your password";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const { user } = await api.login({ email, password });
      toast.push(`Welcome back, ${user.fullName.split(" ")[0]}`);
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not sign in. Try again.",
      );
      setLoading(false);
    }
  }

  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  async function tryDemo(as: (typeof DEMOS)[number]["as"]) {
    setError(null);
    setFieldErrors({});
    setDemoLoading(as);
    try {
      const { user } = await api.demoLogin(as);
      toast.push(`Signed in as ${user.fullName}`);
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not open the demo. Try again.",
      );
      setDemoLoading(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-[27px] font-bold tracking-[-0.02em] text-ink">
        Welcome back
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Sign in to see live stations, your reservations and any session running now.
      </p>

      {expired ? (
        <div
          role="status"
          className="mt-5 rounded-[14px] bg-amber-tint px-4 py-3 text-[13px] leading-relaxed font-medium text-amber-dark"
        >
          Your session is no longer valid. Please sign in again.
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <FormError message={error} />

        <Field label="Email" error={fieldErrors.email}>
          <Input
            type="email"
            value={email}
            autoComplete="email"
            placeholder="you@example.com"
            error={Boolean(fieldErrors.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          <Input
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder="••••••••"
            error={Boolean(fieldErrors.password)}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 vg-card p-4">
        <p className="text-[13px] font-semibold text-ink">Try the demo in one click</p>
        <p className="mt-0.5 text-[12px] text-faint">
          No sign-up needed. Demo data resets every day at {DEMO_RESET_TIME} (Bangkok time).
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DEMOS.map((demo) => (
            <button
              key={demo.as}
              type="button"
              onClick={() => void tryDemo(demo.as)}
              disabled={demoLoading !== null}
              aria-busy={demoLoading === demo.as}
              className="rounded-[14px] border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand disabled:opacity-60"
            >
              <span className="block text-[13px] font-semibold text-ink">
                {demoLoading === demo.as ? "Opening…" : demo.label}
              </span>
              <span className="block text-[11.5px] text-faint">{demo.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[11.5px] text-faint">
          Or sign in above with user1@example.com, admin@example.com or
          operator@example.com · password {DEMO_PASSWORD}
        </p>
      </div>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        No account yet?{" "}
        <Link href="/register" className="font-semibold text-brand">
          Create one
        </Link>
      </p>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="vg-skeleton h-80 rounded-[18px]" />}>
      <Form />
    </Suspense>
  );
}
