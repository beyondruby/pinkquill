/**
 * Shared auth validation rules.
 *
 * Single source of truth for username/password rules that need to agree
 * between the client (UI feedback) and the server (authoritative check).
 * If you change a rule here, the matching error text on both sides updates
 * automatically.
 */

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------

/** Letters, numbers, and underscores. Case-insensitive on input — the server
 *  lowercases the username before storing, so a value that passes this regex
 *  will also pass the lowercase-only check after normalization. */
export const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 30;

/** Names we never let users register, regardless of casing. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "moderator",
  "mod",
  "staff",
  "official",
  "pinkquill",
  "quill",
]);

/** Strip a leading @, trim, lowercase. The canonical form we store. */
export function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

/** Returns null if valid, otherwise a user-facing error message. */
export function validateUsername(raw: string): string | null {
  const cleaned = normalizeUsername(raw);
  if (!cleaned) return "Username is required";
  if (cleaned.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (cleaned.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer`;
  }
  if (!USERNAME_RE.test(cleaned)) {
    return "Username can only contain letters, numbers, and underscores";
  }
  if (RESERVED_USERNAMES.has(cleaned)) {
    return "That username is unavailable";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export interface PasswordCheckResult {
  valid: boolean;
  error: string | null;
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong. Drives the meter. */
  score: PasswordStrength;
}

/**
 * Required: 8+ chars, ≥1 letter, ≥1 number.
 * Score is purely informational — `valid` is what gates submission.
 */
export function validatePasswordStrength(password: string): PasswordCheckResult {
  if (!password) {
    return { valid: false, error: "Password is required", score: 0 };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      score: scorePassword(password),
    };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
      score: scorePassword(password),
    };
  }
  if (!/[A-Za-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one letter",
      score: scorePassword(password),
    };
  }
  if (!/\d/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one number",
      score: scorePassword(password),
    };
  }

  return { valid: true, error: null, score: scorePassword(password) };
}

function scorePassword(password: string): PasswordStrength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4) as PasswordStrength;
}
