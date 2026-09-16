"use client";

import { useState, useTransition } from "react";
import { renameTeam } from "@/app/admin/actions";

interface Props {
  slug: string;
  teamId: string;
  initialName: string;
  isDraft: boolean;
}

export function TeamNameEditor({ slug, teamId, initialName, isDraft }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      setIsEditing(false);
      setName(initialName);
      return;
    }
    startTransition(async () => {
      try {
        await renameTeam(slug, teamId, trimmed);
        setIsEditing(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to rename team");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setName(initialName);
    }
  };

  if (!isDraft) {
    return <span className="text-sm font-medium text-[var(--color-text-main)]">{initialName}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isPending}
          className="rounded-md border-2 border-[var(--color-navy)] bg-white px-2 py-0.5 text-xs font-semibold text-[var(--color-navy)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-[var(--color-navy)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-gold)] hover:bg-[var(--color-navy-hover)]"
        >
          {isPending ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setName(initialName);
          }}
          disabled={isPending}
          className="text-xs text-[var(--color-text-muted)] hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="text-sm font-medium text-[var(--color-text-main)]">{initialName}</span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="opacity-40 transition group-hover:opacity-100 hover:text-[var(--color-navy)] text-[11px]"
        title="Edit team name"
      >
        ✏️
      </button>
    </div>
  );
}
