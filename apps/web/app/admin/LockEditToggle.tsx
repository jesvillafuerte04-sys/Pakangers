"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleTournamentLock } from "./actions";

export function LockEditToggle({
  slug,
  status,
  size = "sm",
}: {
  slug: string;
  status: string;
  size?: "sm" | "md";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isLocked = status !== "draft";

  function handleToggleTo(target: "locked" | "draft") {
    if (target === "draft" && (status === "in_progress" || status === "completed")) {
      if (!confirm("This tournament has already started. Toggling to Edit will revert it to draft mode. Continue?")) {
        return;
      }
    }
    startTransition(async () => {
      try {
        await toggleTournamentLock(slug, target);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to change lock state");
      }
    });
  }

  const paddingClass = size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <div
      className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5"
      role="group"
      aria-label="Lock and Edit toggle"
    >
      {/* Edit Option */}
      {!isLocked ? (
        <Link
          href={`/admin/${slug}`}
          className={`flex items-center gap-1 rounded-md bg-[var(--color-navy)] ${paddingClass} font-bold text-white shadow-xs transition`}
          title="Tournament is unlocked. Click to edit setup."
        >
          <span>✏️</span>
          <span>Edit</span>
        </Link>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleToggleTo("draft")}
          className={`flex items-center gap-1 rounded-md ${paddingClass} font-medium text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-navy)] transition disabled:opacity-50`}
          title="Setup is locked. Toggle to Edit to modify setup."
        >
          <span>✏️</span>
          <span>Edit</span>
        </button>
      )}

      {/* Lock Option */}
      {isLocked ? (
        <div
          className={`flex items-center gap-1 rounded-md bg-[var(--color-gold)] ${paddingClass} font-bold text-[var(--color-navy)] shadow-xs select-none`}
          title="Locked: Setup cannot be edited. Toggle to Edit to modify."
        >
          <span>🔒</span>
          <span>Lock</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleToggleTo("locked")}
          className={`flex items-center gap-1 rounded-md ${paddingClass} font-medium text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-navy)] transition disabled:opacity-50`}
          title="Click to toggle to Lock (freeze setup)"
        >
          <span>🔒</span>
          <span>Lock</span>
        </button>
      )}
    </div>
  );
}
