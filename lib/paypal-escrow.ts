import { paypalFetch } from "@/lib/paypal";

interface PayPalOrderResource {
  id: string;
  status: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status?: string }>;
      authorizations?: Array<{ id: string; status?: string }>;
    };
  }>;
}

interface PayPalAuthorizationCapture {
  id?: string;
  status?: string;
}

function getFirstAuthorizationId(order: PayPalOrderResource): string | null {
  return order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ?? null;
}

function getFirstCaptureId(order: PayPalOrderResource): string | null {
  return order.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
}

function isAlreadyCapturedError(message: string): boolean {
  const normalized = message.toUpperCase();
  return normalized.includes("AUTHORIZATION_ALREADY_CAPTURED")
    || normalized.includes("AUTHORIZATION_CAPTURED")
    || normalized.includes("PREVIOUSLY_CAPTURED");
}

export interface PayPalEscrowCaptureResult {
  alreadyCaptured: boolean;
  paymentReference: string;
  captureId?: string | null;
  authorizationId?: string | null;
}

interface CapturePayPalEscrowInput {
  paypalOrderId: string;
  authorizationReference?: string | null;
  idempotencyKey?: string;
}

/**
 * Capture a previously-authorized PayPal payment for commission escrow release.
 * Returns the best payment reference to persist on the order (prefer capture ID).
 */
export async function capturePayPalEscrowAuthorization({
  paypalOrderId,
  authorizationReference,
  idempotencyKey,
}: CapturePayPalEscrowInput): Promise<PayPalEscrowCaptureResult> {
  const order = await paypalFetch<PayPalOrderResource>(`/v2/checkout/orders/${paypalOrderId}`);
  const existingCaptureId = getFirstCaptureId(order);
  const existingAuthorizationId = getFirstAuthorizationId(order);

  if (existingCaptureId) {
    return {
      alreadyCaptured: true,
      paymentReference: existingCaptureId,
      captureId: existingCaptureId,
      authorizationId: existingAuthorizationId,
    };
  }

  const authorizationId = existingAuthorizationId || authorizationReference || null;
  if (!authorizationId || authorizationId === paypalOrderId) {
    throw new Error("PayPal authorization reference is missing for escrow release");
  }

  try {
    const capture = await paypalFetch<PayPalAuthorizationCapture>(
      `/v2/payments/authorizations/${authorizationId}/capture`,
      {
        method: "POST",
        body: { final_capture: true },
        idempotencyKey,
      }
    );

    const captureStatus = capture.status?.toUpperCase() || "";
    if (captureStatus && !["COMPLETED", "PENDING"].includes(captureStatus)) {
      throw new Error(`PayPal authorization capture failed (status: ${capture.status})`);
    }

    return {
      alreadyCaptured: false,
      paymentReference: capture.id || authorizationId,
      captureId: capture.id || null,
      authorizationId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyCapturedError(message)) {
      throw error;
    }

    // If capture was already processed, refetch order and recover the capture reference.
    const latestOrder = await paypalFetch<PayPalOrderResource>(`/v2/checkout/orders/${paypalOrderId}`);
    const latestCaptureId = getFirstCaptureId(latestOrder);

    return {
      alreadyCaptured: true,
      paymentReference: latestCaptureId || authorizationId,
      captureId: latestCaptureId,
      authorizationId,
    };
  }
}
