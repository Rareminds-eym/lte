export function resolveLearnerName(user: {
  first_name?: string | null;
  last_name?: string | null;
}): string | null {
  return (
    [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 255) || null
  );
}
