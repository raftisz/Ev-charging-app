"use client";

import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { InlineError } from "@/components/ui/States";

type FieldProps = { label: string; hint?: string; error?: string | null; children: ReactNode };

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="vg-label">{label}</span>
      {children}
      {hint && !error ? (
        <span className="mt-1.5 block text-[12px] text-faint">{hint}</span>
      ) : null}
      <InlineError message={error} />
    </label>
  );
}

export function Input({
  className,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={clsx("vg-input", error && "border-danger", className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx("vg-input cursor-pointer pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...rest
}: InputHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx("vg-input h-auto py-3 leading-relaxed", className)}
      {...(rest as object)}
    />
  );
}
