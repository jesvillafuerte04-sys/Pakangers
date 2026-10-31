/**
 * Default name for a doubles team that was not given one: the two players'
 * family names, "Bacud X Ramayla". Pakangers' house style for every event.
 */
export function familyPairName(lastNames: string[]): string {
  const tidy = (s: string) =>
    s.trim().replace(/\s+/g, " ").replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  return lastNames.map(tidy).filter(Boolean).join(" X ");
}

/** A name the app made up while the team was empty ("Team 4"), safe to replace. */
export function isPlaceholderTeamName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return n === "" || /^(Team|Slot|Clan) \d+$/i.test(n);
}

/**
 * "Mevil Bacud (Meb)" -> a player with nickname "Meb". The nickname is the
 * name shown wherever a full roster is too long, such as a tiebreak note.
 */
export function parsePlayerLine(line: string): { first_name: string; last_name: string; nickname: string | null } {
  const m = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const full = (m ? m[1]! : line).trim();
  const nickname = m?.[2]?.trim() || null;
  const parts = full.split(/\s+/);
  // Family name is the last word, so "Sheri Ann Laurice Sarsuelo" files under Sarsuelo.
  const last_name = parts.length > 1 ? parts.at(-1)! : "";
  const first_name = parts.length > 1 ? parts.slice(0, -1).join(" ") : full;
  return { first_name, last_name, nickname };
}
