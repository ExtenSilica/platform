/** Mirrors `store-backend/src/passwordPolicy.ts` for client-side hints. */
export function passwordPolicyError(password: string): string | null {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password)) return "Password must include at least one letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one digit.";
  return null;
}
