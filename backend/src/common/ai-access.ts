/**
 * Who may use the AI features (analysis, suggestions). Every use is a paid
 * call, so access is a role: the `aiAccess` flag on the user, or the user's
 * e-mail address being listed in AI_ALLOWED_EMAILS (comma separated; `*`
 * lets everyone in, handy for local development).
 */
export function hasAiAccess(
  user: { email?: string | null; aiAccess?: boolean | null } | null | undefined,
  allowedEmails: string | undefined = process.env.AI_ALLOWED_EMAILS,
): boolean {
  if (!user) return false;
  if (user.aiAccess) return true;
  const list = (allowedEmails ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes('*')) return true;
  return !!user.email && list.includes(user.email.toLowerCase());
}
