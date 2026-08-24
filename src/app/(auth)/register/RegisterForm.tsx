"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  vehicleMake: string;
  vehicleModel: string;
};

const EMPTY: FormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
  vehicleMake: "",
  vehicleModel: "",
};

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function validate() {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = "Please enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (form.password.length < 8) next.password = "Use at least 8 characters";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await api.register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
      });
      toast.push("Account created. Welcome to Volt Grid.");
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.details)) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of err.details as { field: string; message: string }[]) {
          fieldErrors[detail.field] = detail.message;
        }
        setErrors(fieldErrors);
      }
      setError(
        err instanceof ApiRequestError ? err.message : "Could not create the account.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-[27px] font-bold tracking-[-0.02em] text-ink">
        Create your account
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        Takes a minute. You can add your car details now or later in Profile.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <FormError message={error} />

        <Field label="Full name" error={errors.fullName}>
          <Input
            value={form.fullName}
            autoComplete="name"
            placeholder="Somchai Patchara"
            error={Boolean(errors.fullName)}
            onChange={set("fullName")}
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={form.email}
            autoComplete="email"
            placeholder="you@example.com"
            error={Boolean(errors.email)}
            onChange={set("email")}
          />
        </Field>

        <Field label="Phone" hint="Optional, used for reservation reminders">
          <Input
            value={form.phone}
            autoComplete="tel"
            placeholder="081 234 5678"
            onChange={set("phone")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Car make" hint="Optional">
            <Input value={form.vehicleMake} placeholder="Tesla" onChange={set("vehicleMake")} />
          </Field>
          <Field label="Car model" hint="Optional">
            <Input value={form.vehicleModel} placeholder="Model 3" onChange={set("vehicleModel")} />
          </Field>
        </div>

        <Field label="Password" error={errors.password} hint="At least 8 characters">
          <Input
            type="password"
            value={form.password}
            autoComplete="new-password"
            error={Boolean(errors.password)}
            onChange={set("password")}
          />
        </Field>

        <Field label="Confirm password" error={errors.confirm}>
          <Input
            type="password"
            value={form.confirm}
            autoComplete="new-password"
            error={Boolean(errors.confirm)}
            onChange={set("confirm")}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Sign in
        </Link>
      </p>
    </div>
  );
}
