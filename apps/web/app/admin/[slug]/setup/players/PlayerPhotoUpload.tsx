"use client";

import { useState, useTransition } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { updatePlayerAvatar, removePlayerAvatar } from "@/app/admin/actions";

export function PlayerPhotoUpload({
  slug,
  tournamentId,
  playerId,
  playerName,
  avatarUrl,
}: {
  slug: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  avatarUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side compression to max 320x320 JPEG
    try {
      const dataUrl = await compressImage(file, 320, 320, 0.85);

      startTransition(async () => {
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("dataUrl", dataUrl);

        const res = await updatePlayerAvatar(slug, playerId, tournamentId, formData);
        if (!res.ok) {
          setError(res.error ?? "Failed to save photo");
        }
      });
    } catch {
      setError("Failed to process image file");
    } finally {
      // Clear input value so same file can be picked again if desired
      e.target.value = "";
    }
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      await removePlayerAvatar(slug, playerId);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative group">
        <PlayerAvatar name={playerName} avatarUrl={avatarUrl} size="md" />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white text-[10px] font-bold">
            ...
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-navy)] shadow-xs transition hover:bg-[var(--surface-sunken)]">
            <span>{isPending ? "Saving..." : avatarUrl ? "Change photo" : "Add photo"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isPending}
              onChange={handleFileChange}
            />
          </label>

          {avatarUrl && !isPending && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition"
            >
              Reset to icon
            </button>
          )}
        </div>

        {error && <p className="text-[10px] text-[var(--color-error)]">{error}</p>}
      </div>
    </div>
  );
}

function compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(img.src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
