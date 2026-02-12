"use client";

/**
 * PayPal Client-side Configuration
 *
 * Provides the PayPal client ID for the @paypal/react-paypal-js PayPalScriptProvider.
 * The actual SDK is loaded by the PayPalScriptProvider component.
 */

export function getPayPalClientId(): string | null {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || null;
}
