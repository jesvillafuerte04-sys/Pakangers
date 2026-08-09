import type { InputHTMLAttributes } from "react";

export function Input({
  label,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      {label && <span className="text-sm font-medium text-[var(--color-navy)]">{label}</span>}
      <input
        className={`w-full rounded-lg border-2 border-[var(--border-subtle)] bg-white px-4 py-3 font-[family-name:var(--font-ui)] text-base text-[var(--color-text-main)] outline-none transition focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_var(--focus-ring)] ${className}`}
        {...rest}
      />
    </label>
  );
}

export function Textarea({
  label,
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      {label && <span className="text-sm font-medium text-[var(--color-navy)]">{label}</span>}
      <textarea
        className={`w-full rounded-lg border-2 border-[var(--border-subtle)] bg-white px-4 py-3 font-[family-name:var(--font-ui)] text-base text-[var(--color-text-main)] outline-none transition focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_var(--focus-ring)] ${className}`}
        {...rest}
      />
    </label>
  );
}
