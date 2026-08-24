"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const DEMOS = [
  { label: "Driver", email: "user1@example.com" },
  { label: "Admin", email: "admin@example.com" },
  { label: "Operator", email: "operator@example.com" },
];

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = params.get("next") || "/dashboard";

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

  function applyDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password123");
    setError(null);
    setFieldErrors({});
  }

  return (
    <div>
      <h1 className="font-display text-[27px] font-bold tracking-[-0.02em] text-ink">
        Welcome back
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Sign in to see live stations, your reservations and any session running now.
      </p>

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

      <div className="mt-6 rounded-[14px] border border-line bg-white p-4">
        <p className="text-[12.5px] font-semibold text-muted">
          Demo accounts · password123
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DEMOS.map((demo) => (
            <button
              key={demo.email}
              type="button"
              onClick={() => applyDemo(demo.email)}
              className="rounded-full border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
            >
              {demo.label}
            </button>
          ))}
        </div>
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
