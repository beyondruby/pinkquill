/**
 * Error categorization utility for better user feedback
 */

// ============================================================================
// RETRY UTILITIES
// ============================================================================

export interface RetryOptions {
  /** Total attempts including the initial try. */
  attempts?: number;
  /** Initial delay before retrying (ms). */
  initialDelayMs?: number;
  /** Maximum backoff delay (ms). */
  maxDelayMs?: number;
  /** Exponential backoff multiplier. */
  factor?: number;
  /** Add jitter to avoid synchronized retries. */
  jitter?: boolean;
  /** Optional custom retry predicate. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === "string" ? msg : String(msg || "");
  }
  return "";
}

/**
 * Best-effort retryability detection for transient network/database failures.
 */
export function isRetryableError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection") ||
    message.includes("temporary") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return true;
  }

  if (!Number.isNaN(status) && (status === 429 || status >= 500)) {
    return true;
  }

  // Common transient Postgres / PostgREST codes
  const retryableCodes = new Set([
    "PGRST003", // pool timeout
    "PGRST301", // gateway/connection issue
    "57014", // statement timeout / query canceled
    "57P03", // cannot connect now
    "53300", // too many connections
  ]);

  return retryableCodes.has(code);
}

/**
 * Retry an async operation with exponential backoff.
 */
export async function retryWithBackoff<T>(
  operation: () => PromiseLike<T> | T,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    initialDelayMs = 250,
    maxDelayMs = 2000,
    factor = 2,
    jitter = true,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await Promise.resolve(operation());
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= attempts;

      if (isLastAttempt || !shouldRetry(error, attempt)) {
        throw error;
      }

      let delay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
      if (jitter) {
        delay = Math.round(delay * (0.75 + Math.random() * 0.5));
      }
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry attempts exhausted");
}

/**
 * Categorize errors for better user feedback
 */
export type ErrorCategory = 'network' | 'auth' | 'validation' | 'not_found' | 'permission' | 'server' | 'unknown';

export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  originalError: unknown;
}

export function categorizeError(error: unknown): CategorizedError {
  const originalError = error;
  let message = 'An unexpected error occurred';
  let category: ErrorCategory = 'unknown';
  let userMessage = 'Something went wrong. Please try again.';

  if (error instanceof Error) {
    message = error.message;
    const lowerMessage = message.toLowerCase();

    // Network errors
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('failed to fetch') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('offline')
    ) {
      category = 'network';
      userMessage = 'Unable to connect. Please check your internet connection and try again.';
    }
    // Auth errors
    else if (
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('unauthenticated') ||
      lowerMessage.includes('jwt') ||
      lowerMessage.includes('token') ||
      lowerMessage.includes('session')
    ) {
      category = 'auth';
      userMessage = 'Your session has expired. Please sign in again.';
    }
    // Not found errors
    else if (
      lowerMessage.includes('not found') ||
      lowerMessage.includes('does not exist') ||
      lowerMessage.includes('no rows')
    ) {
      category = 'not_found';
      userMessage = 'The requested content could not be found.';
    }
    // Permission errors
    else if (
      lowerMessage.includes('permission') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('access denied') ||
      lowerMessage.includes('policy')
    ) {
      category = 'permission';
      userMessage = "You don't have permission to perform this action.";
    }
    // Validation errors
    else if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('validation') ||
      lowerMessage.includes('constraint') ||
      lowerMessage.includes('duplicate')
    ) {
      category = 'validation';
      userMessage = 'The provided information is invalid. Please check and try again.';
    }
    // Server errors
    else if (
      lowerMessage.includes('server') ||
      lowerMessage.includes('internal') ||
      lowerMessage.includes('500')
    ) {
      category = 'server';
      userMessage = 'Our servers are experiencing issues. Please try again later.';
    }
  }

  return {
    category,
    message,
    userMessage,
    originalError,
  };
}
