/**
 * Error categorization utility for better user feedback
 */

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
