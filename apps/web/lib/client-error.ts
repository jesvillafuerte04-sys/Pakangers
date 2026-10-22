"use client";

/**
 * Handles server action errors gracefully.
 * If a new deployment just occurred on Vercel while the user's tab was open,
 * Next.js invalidates previous build action hashes (error: "Server Action ... was not found on the server").
 * In that case, automatically reload to pick up the latest build manifest.
 */
export function handleActionError(err: unknown, fallbackMessage: string): void {
  if (
    err instanceof Error &&
    (err.message.includes("was not found on the server") ||
      err.message.includes("failed-to-find-server-action") ||
      err.message.includes("Failed to find Server Action"))
  ) {
    window.location.reload();
    return;
  }
  alert(err instanceof Error ? err.message : fallbackMessage);
}
