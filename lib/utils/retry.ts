/**
 * Retry utility for handling transient failures
 * Implements exponential backoff with configurable options
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable (default: retries network errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  isRetryable: (error: unknown) => {
    // Retry on network errors and certain Supabase errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('failed to fetch') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('socket hang up')
      );
    }
    return false;
  },
  onRetry: () => {},
};

/**
 * Execute a function with retry logic
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt or non-retryable errors
      if (attempt === config.maxAttempts || !config.isRetryable(error)) {
        throw error;
      }

      // Call onRetry callback
      config.onRetry(attempt, error, delay);

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a retryable version of a Supabase query
 * Automatically retries on network errors
 */
export function createRetryableQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  return withRetry(async () => {
    const result = await queryFn();
    // Throw on error so retry logic can catch it
    if (result.error && options.isRetryable?.(result.error)) {
      throw result.error;
    }
    return result;
  }, options).catch((error) => ({
    data: null,
    error: error instanceof Error ? error : new Error(String(error)),
  }));
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
