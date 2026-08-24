"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tint" | "ghost" | "danger" | "green";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary:
    "bg-white text-ink border border-line-strong hover:border-faint-soft hover:bg-surface-alt",
  tint: "bg-brand-tint text-brand hover:bg-[#dce6f5]",
  ghost: "bg-transparent text-muted hover:bg-surface-alt",
  danger: "bg-danger text-white hover:bg-danger-dark",
  green: "bg-grid-green text-white hover:bg-grid-green-dark",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] rounded-[10px]",
  md: "h-11 px-4 text-[13.5px] rounded-xl",
  lg: "h-[52px] px-5 text-[15px] rounded-[14px]",
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
