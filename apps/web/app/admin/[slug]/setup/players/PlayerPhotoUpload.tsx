"use client";

import { useState, useTransition } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { updatePlayerAvatar, removePlayerAvatar } from "@/app/admin/actions";

export function PlayerPhotoUpload({
  slug,
  playerId,
  playerName,
  avatarUrl,
}: {
  slug: string;
  playerId: string;
  playerName: string;
  avatarUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [currentUrl, setCurrentUrl] = useState<string | null>(avatarUrl);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      // 1. Client-side high-quality compression to 320x320 WebP (~25KB)
      const compressedBlob = await compressImageToBlob(file, 320, 320, 0.85);
      const compressedFile = new File([compressedBlob], `${playerId}.webp`, {
        type: compressedBlob.type,
      });

      startTransition(async () => {
        const formData = new FormData();
        // Send ONLY the tiny compressed file (25KB), NEVER the 5MB-10MB raw camera file!
        formData.append("photo", compressedFile);

        const res = await updatePlayerAvatar(slug, playerId, formData);
        if (!res.ok) {
          setError(res.error ?? "Failed to save photo");
        } else if (res.avatarUrl) {
          setCurrentUrl(res.avatarUrl);
        }
      });
    } catch {
      setError("Failed to compress image. Please try another photo.");
    } finally {
      e.target.value = "";
    }
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      await removePlayerAvatar(slug, playerId);
      setCurrentUrl(null);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative group">
        <PlayerAvatar name={playerName} avatarUrl={currentUrl} size="md" />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white text-[10px] font-bold">
            ...
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-navy)] shadow-xs transition hover:bg-[var(--surface-sunken)] active:scale-95">
            <span>{isPending ? "Saving..." : currentUrl ? "Change photo" : "Add photo"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isPending}
              onChange={handleFileChange}
            />
          </label>

          {currentUrl && !isPending && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition"
            >
              Reset to icon
            </button>
          )}
        </div>

        {error && <p className="text-[10px] font-medium text-[var(--color-error)]">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Compresses an image to max maxWidth x maxHeight with high-quality bicubic smoothing
 * and returns a compact Blob (typically 20KB - 35KB) using WebP (or JPEG fallback).
 */
function compressImageToBlob(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
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
          reject(new Error("Unable to create canvas context"));
          return;
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              canvas.toBlob(
                (jpegBlob) => {
                  if (jpegBlob) resolve(jpegBlob);
                  else reject(new Error("Failed to export image blob"));
                },
                "image/jpeg",
                quality,
              );
            }
          },
          "image/webp",
          quality,
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
  });
}
