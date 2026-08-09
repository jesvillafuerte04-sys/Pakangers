import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-transparent font-[family-name:var(--font-ui)] font-semibold cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed";

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-7 py-3.5 text-base",
  lg: "px-9 py-4.5 text-lg",
};

const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-navy)] text-[var(--color-gold)] hover:bg-[var(--color-navy-hover)]",
  secondary: "bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-hover)]",
  outline: "bg-transparent border-[var(--color-navy)] text-[var(--color-navy)] hover:bg-[var(--color-cream-dark)]",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; fullWidth?: boolean }) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
