import { Cake } from "lucide-react";

import { cn } from "../lib/utils";
import {
  UserNameFields,
  formatUserDisplayName,
  hasUserBirthday,
} from "../lib/userDisplay";

type BirthdayBadgeProps = {
  className?: string;
  title?: string;
};

/** Compact birthday marker shown next to a user's name. */
export function BirthdayBadge({
  className,
  title = "امروز تولد این کاربر است",
}: BirthdayBadgeProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
        className
      )}
    >
      <Cake className="h-[0.85em] w-[0.85em]" strokeWidth={2.25} aria-hidden />
    </span>
  );
}

type UserDisplayNameProps = {
  user: UserNameFields | null | undefined;
  fallback?: string;
  className?: string;
  nameClassName?: string;
  badgeClassName?: string;
  showBirthday?: boolean;
};

/** Renders a user display name with an optional birthday cake icon. */
export default function UserDisplayName({
  user,
  fallback = "",
  className,
  nameClassName,
  badgeClassName,
  showBirthday = true,
}: UserDisplayNameProps) {
  const name = formatUserDisplayName(user, fallback);
  if (!name) return null;
  const birthday = showBirthday && hasUserBirthday(user);

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <span className={cn("truncate", nameClassName)}>{name}</span>
      {birthday ? <BirthdayBadge className={cn("h-5 w-5", badgeClassName)} /> : null}
    </span>
  );
}
