/**
 * Developer credit. Rendered per-layout rather than once in the root layout,
 * because the public pages have a fixed bottom nav -- a root-level footer sits
 * underneath it and is never visible. Placing it inside each layout's scroll
 * area keeps it on screen everywhere.
 */
export function BuiltByCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`py-6 text-center text-xs text-[var(--color-text-muted)] opacity-60 ${className}`}>
      Built by Jes Villafuerte
    </p>
  );
}
