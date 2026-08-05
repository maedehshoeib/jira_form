export type UserNameFields = {
  display_name?: string | null;
  username?: string | null;
  birth_date?: string | null;
  is_birthday?: boolean;
};

/** Compare month/day of an ISO date (YYYY-MM-DD) with the local calendar day. */
export function isBirthdayToday(birthDate?: string | null): boolean {
  if (!birthDate) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const now = new Date();
  return now.getMonth() + 1 === month && now.getDate() === day;
}

export function hasUserBirthday(user: UserNameFields | null | undefined): boolean {
  if (!user) return false;
  return user.is_birthday ?? isBirthdayToday(user.birth_date);
}

/** Plain display name (no birthday marker — use UserDisplayName / BirthdayBadge in UI). */
export function formatUserDisplayName(
  user: UserNameFields | null | undefined,
  fallback = ""
): string {
  if (!user) return fallback;
  return (user.display_name || user.username || fallback).trim() || fallback;
}
