"use client";

import { useState, useTransition } from "react";
import { renamePoolGroup } from "@/app/admin/actions";

interface Props {
  slug: string;
  groupId: string;
  initialName: string;
  isDraft: boolean;
}

export function BracketNameEditor({ slug, groupId, initialName, isDraft }: Props) {
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
        await renamePoolGroup(slug, groupId, trimmed);
        setIsEditing(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to rename bracket");
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
    return <span className="font-bold text-[var(--color-navy)]">Bracket {initialName}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-[var(--color-navy)]">Bracket</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isPending}
          className="w-24 rounded-lg border-2 border-[var(--color-navy)] bg-white px-2 py-0.5 text-xs font-bold text-[var(--color-navy)] focus:outline-none"
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
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-[var(--color-navy)]">Bracket {initialName}</span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="opacity-70 transition hover:opacity-100 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-navy)]"
        title="Rename bracket"
      >
        ✏️
      </button>
    </div>
  );
}
