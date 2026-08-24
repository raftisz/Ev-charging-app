"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tint" | "ghost" | "danger" | "green";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.85)] hover:bg-brand-dark",
  secondary:
    "bg-white text-ink shadow-[0_4px_14px_-8px_rgba(30,58,138,0.4)] hover:bg-surface",
  tint: "bg-brand-tint text-brand hover:bg-[#d8e6ff]",
  ghost: "bg-transparent text-muted hover:bg-surface-alt",
  danger:
    "bg-danger text-white shadow-[0_8px_20px_-10px_rgba(239,68,68,0.8)] hover:bg-danger-dark",
  green:
    "bg-grid-green text-white shadow-[0_8px_20px_-10px_rgba(5,150,105,0.8)] hover:bg-grid-green-dark",
};

/* The concept uses capsules almost everywhere, so every size is pill-shaped. */
const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-full",
  md: "h-11 px-5 text-[13.5px] rounded-full",
  lg: "h-[52px] px-6 text-[15px] rounded-full",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: string;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  loading,
  fullWidth,
  icon,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  const classes = clsx(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors select-none",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    (disabled || loading) && "cursor-not-allowed opacity-55",
    className,
  );

  const content = (
    <>
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}
