/**
 * Streams instantly on navigation so tapping a tab paints immediately instead
 * of blocking on the server render. The public nav lives in the layout, so it
 * stays interactive while this shows.
 */
export default function PublicLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative overflow-hidden rounded-2xl bg-[var(--surface-card)] p-6 shadow-[var(--shadow-md)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[var(--color-gold)]" />
          <div className="flex animate-pulse flex-col gap-3">
            <div className="h-3 w-24 rounded bg-[var(--surface-sunken)]" />
            <div className="h-5 w-2/3 rounded bg-[var(--surface-sunken)]" />
            <div className="h-5 w-1/2 rounded bg-[var(--surface-sunken)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
