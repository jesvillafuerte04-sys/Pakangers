"use client";

import { useState } from "react";

export type PlayerAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showBorder?: boolean;
};

const SIZE_CLASSES = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base font-bold",
  xl: "w-16 h-16 text-xl font-bold",
};

/** Generates clean initials from a full name (e.g., "Jes Villafuerte" -> "JV"). */
export function getInitials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Consistent background tones based on name hash for default avatars */
const AVATAR_BG_COLORS = [
  "bg-[var(--color-navy)] text-[var(--color-gold)]",
  "bg-[#243B55] text-white",
  "bg-[#1A365D] text-[var(--color-cream)]",
  "bg-[#2C3E50] text-[#E0EAFC]",
  "bg-[#1E3A8A] text-[#93C5FD]",
  "bg-[#0F172A] text-[var(--color-gold)]",
];

function getAvatarColor(name?: string | null): string {
  const str = (name ?? "").trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[index] ?? AVATAR_BG_COLORS[0]!;
}

export function PlayerAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
  showBorder = true,
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const safeName = (name ?? "").trim() || "Player";
  const initials = getInitials(safeName);
  const borderClass = showBorder ? "ring-2 ring-white shadow-xs" : "";

  // If a valid avatar URL is supplied and hasn't failed to load
  if (avatarUrl && !imgError) {
    return (
      <div
        className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${sizeClass} ${borderClass} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={safeName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Elegant fallback: Initials badge with brand theme
  const bgTone = getAvatarColor(safeName);

  return (
    <div
      title={safeName}
      className={`inline-flex flex-shrink-0 select-none items-center justify-center rounded-full font-semibold ${bgTone} ${sizeClass} ${borderClass} ${className}`}
    >
      <span>{initials}</span>
    </div>
  );
}

export type PlayerInfo = {
  id?: string;
  name: string;
  avatarUrl?: string | null;
};

export function TeamAvatarGroup({
  players,
  size = "sm",
  className = "",
}: {
  players?: PlayerInfo[];
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  if (!players || players.length === 0) {
    return null;
  }

  if (players.length === 1) {
    const p = players[0]!;
    return <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={size} className={className} />;
  }

  // For doubles (2 players) or teams: overlapping cluster
  return (
    <div className={`inline-flex items-center -space-x-2 overflow-visible ${className}`}>
      {players.map((p, idx) => (
        <PlayerAvatar
          key={p.id ?? `${p.name}-${idx}`}
          name={p.name}
          avatarUrl={p.avatarUrl}
          size={size}
          className="transition-transform hover:z-10 hover:scale-110"
        />
      ))}
    </div>
  );
}
