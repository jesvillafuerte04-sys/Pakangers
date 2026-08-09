import type { HTMLAttributes } from "react";

export function Card({
  title,
  accent = true,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { title?: string; accent?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[var(--surface-card)] p-6 shadow-[var(--shadow-md)] ${className}`}
      {...rest}
    >
      {accent && <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--color-gold)]" />}
      {title && (
        <h3 className="mb-2 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[var(--color-navy)]">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
