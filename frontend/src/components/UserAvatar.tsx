type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "?"
  );
}

export default function UserAvatar({
  name,
  avatarUrl,
  className = "h-10 w-10 rounded-xl",
  fallbackClassName = "bg-red-50 text-red-600",
}: UserAvatarProps) {
  if (avatarUrl) {
    // Older uploads used /avatars, which bypasses Vite's /api development proxy.
    const resolvedUrl = avatarUrl.startsWith("/avatars/")
      ? `/api/v1${avatarUrl}`
      : avatarUrl;
    return (
      <img
        src={resolvedUrl}
        alt={name}
        className={`${className} shrink-0 object-cover`}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`${className} ${fallbackClassName} flex shrink-0 items-center justify-center text-sm font-bold`}
    >
      {initials(name)}
    </span>
  );
}
