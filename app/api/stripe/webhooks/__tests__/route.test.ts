// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const SECRET = "whsec_test_secret_for_unit_tests";
const signer = new Stripe("sk_test_placeholder", { apiVersion: "2026-01-28.clover" });

const rpc = vi.hoisted(() => ({
  claimStripeEvent: vi.fn(),
  finishStripeEvent: vi.fn(),
  recordPaymentSucceeded: vi.fn(),
  recordPaymentFailed: vi.fn(),
  recordCheckoutExpired: vi.fn(),
  recordPaymentRefund: vi.fn(),
  markPayoutReversed: vi.fn(),
  recordChargeback: vi.fn(),
  unblockPayoutsForSeller: vi.fn(),
}));
const stripeMock = vi.hoisted(() => ({
  paymentIntents: { retrieve: vi.fn() },
  refunds: { create: vi.fn(), list: vi.fn() },
  transfers: { createReversal: vi.fn() },
}));
const ops = vi.hoisted(() => ({ reportOpsAlert: vi.fn() }));

vi.mock("@/lib/payments-server", () => rpc);
vi.mock("@/lib/ops", () => ops);
vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({ ...stripeMock, webhooks: signer.webhooks }),
}));
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }), eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

import { POST } from "@/app/api/stripe/webhooks/route";

function signedRequest(event: Record<string, unknown>, secret = SECRET): Request {
  const payload = JSON.stringify(event);
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/stripe/webhooks", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
}

const sessionPaid = {
  id: "evt_1", type: "checkout.session.completed", object: "event",
  data: { object: { id: "cs_1", object: "checkout.session", payment_status: "paid", payment_intent: "pi_1", amount_total: 775, currency: "cad", metadata: { order_id: "o_1" } } },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  rpc.claimStripeEvent.mockResolvedValue("claimed");
  stripeMock.paymentIntents.retrieve.mockResolvedValue({
    id: "pi_1", amount_received: 775, currency: "cad",
    latest_charge: { id: "ch_1", balance_transaction: { fee: 59 } },
  });
});

describe("POST /api/stripe/webhooks", () => {
  it("rejects a bad signature before touching the database", async () => {
    const res = await POST(signedRequest(sessionPaid, "whsec_wrong"));
    expect(res.status).toBe(400);
    expect(rpc.claimStripeEvent).not.toHaveBeenCalled();
  });

  it("acknowledges duplicates without processing", async () => {
    rpc.claimStripeEvent.mockResolvedValue("duplicate");
    const res = await POST(signedRequest(sessionPaid));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(rpc.recordPaymentSucceeded).not.toHaveBeenCalled();
  });

  it("records a paid session with the charged amount, currency and Stripe fee", async () => {
    rpc.recordPaymentSucceeded.mockResolvedValue({ outcome: "paid" });
    const res = await POST(signedRequest(sessionPaid));
    expect(res.status).toBe(200);
    expect(rpc.recordPaymentSucceeded).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "o_1", paymentIntentId: "pi_1", chargeId: "ch_1", checkoutSessionId: "cs_1",
      amountCents: 775, currency: "cad", stripeFeeCents: 59, eventId: "evt_1",
    }));
    expect(rpc.finishStripeEvent).toHaveBeenCalledWith("evt_1", "processed", "paid", "o_1");
  });

  it("ignores a completed session that is not actually paid (async methods)", async () => {
    const res = await POST(signedRequest({ ...sessionPaid, data: { object: { ...sessionPaid.data.object, payment_status: "unpaid" } } }));
    expect(res.status).toBe(200);
    expect(rpc.recordPaymentSucceeded).not.toHaveBeenCalled();
    expect(rpc.finishStripeEvent).toHaveBeenCalledWith("evt_1", "ignored", expect.stringMatching(/unpaid/), "o_1");
  });

  it("auto-refunds a payment whose amount does not match the order", async () => {
    rpc.recordPaymentSucceeded.mockResolvedValue({ outcome: "amount_mismatch", expected_cents: 775 });
    stripeMock.refunds.create.mockResolvedValue({ id: "re_1", amount: 700 });
    rpc.recordPaymentRefund.mockResolvedValue({ outcome: "mismatch_refunded" });
    const res = await POST(signedRequest({ ...sessionPaid, data: { object: { ...sessionPaid.data.object, amount_total: 700 } } }));
    expect(res.status).toBe(200);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_1" }),
      expect.objectContaining({ idempotencyKey: "refund_unhonoured_pi_1" })
    );
    expect(rpc.recordPaymentRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_1", refundId: "re_1", refundedCentsTotal: 700 }));
    expect(ops.reportOpsAlert).toHaveBeenCalledWith(expect.objectContaining({ kind: "unhonoured_payment_refunded" }));
  });

  it("records a declined payment", async () => {
    rpc.recordPaymentFailed.mockResolvedValue({ outcome: "failed" });
    const res = await POST(signedRequest({
      id: "evt_2", type: "payment_intent.payment_failed", object: "event",
      data: { object: { id: "pi_2", object: "payment_intent", metadata: { order_id: "o_2" }, last_payment_error: { code: "card_declined", decline_code: "generic_decline", message: "Your card was declined." } } },
    }));
    expect(res.status).toBe(200);
    expect(rpc.recordPaymentFailed).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o_2", paymentIntentId: "pi_2", code: "generic_decline" }));
  });

  it("marks the event failed and returns 500 so Stripe retries when a handler throws", async () => {
    rpc.recordPaymentSucceeded.mockRejectedValue(new Error("db down"));
    const res = await POST(signedRequest(sessionPaid));
    expect(res.status).toBe(500);
    expect(rpc.finishStripeEvent).toHaveBeenCalledWith("evt_1", "failed", "db down");
    expect(ops.reportOpsAlert).toHaveBeenCalledWith(expect.objectContaining({ kind: "webhook_failed" }));
  });

  it("routes chargebacks to record_chargeback and reclaims a sent payout", async () => {
    rpc.recordChargeback.mockResolvedValue({ outcome: "created", payout_transfer_id: "tr_9", order_status: "disputed" });
    stripeMock.transfers.createReversal.mockResolvedValue({ id: "trr_9", amount: 661 });
    const res = await POST(signedRequest({
      id: "evt_3", type: "charge.dispute.created", object: "event",
      data: { object: { id: "dp_1", object: "dispute", payment_intent: "pi_1", status: "needs_response", reason: "fraudulent", amount: 775, currency: "cad", evidence_details: { due_by: 1800000000 } } },
    }));
    expect(res.status).toBe(200);
    expect(rpc.recordChargeback).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_1", stripeDisputeId: "dp_1", phase: "created", amountCents: 775 }));
    expect(stripeMock.transfers.createReversal).toHaveBeenCalledWith("tr_9", expect.anything(), expect.objectContaining({ idempotencyKey: "reversal_chargeback_dp_1" }));
    expect(rpc.markPayoutReversed).toHaveBeenCalledWith(expect.objectContaining({ transferId: "tr_9", reversedCents: 661 }));
  });
});
