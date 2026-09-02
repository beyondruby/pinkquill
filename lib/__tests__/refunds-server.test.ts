// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  claimApprovedRefunds: vi.fn(),
  markPayoutReversed: vi.fn(),
  markRefundNeedsReview: vi.fn(),
  markRefundSubmitted: vi.fn(),
}));
const provider = vi.hoisted(() => ({
  createRefund: vi.fn(),
  reverseTransfer: vi.fn(),
}));
const db = vi.hoisted(() => ({ payment: null as unknown, payout: null as unknown }));
const ops = vi.hoisted(() => ({ reportOpsAlert: vi.fn() }));

vi.mock("@/lib/payments-server", () => rpc);
vi.mock("@/lib/ops", () => ops);
vi.mock("@/lib/payment-provider", () => ({
  getActiveProvider: () => provider,
  TransferBlockedError: class TransferBlockedError extends Error {
    constructor(public readonly reason: string, message?: string) { super(message || reason); this.name = "TransferBlockedError"; }
  },
}));
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "payments" ? db.payment : null }),
          eq: () => ({ maybeSingle: async () => ({ data: table === "payouts" ? db.payout : null }) }),
        }),
      }),
    }),
  },
}));

import { executeApprovedRefunds } from "@/lib/refunds-server";

const refund = {
  id: "rf_1", order_id: "o_1", payment_id: "pm_1", initiator_role: "buyer", kind: "full" as const,
  amount_cents: 775, currency: "cad", seller_share_cents: 661, status: "processing", attempts: 1, stripe_refund_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.payment = { payment_intent_id: "pi_1", amount_cents: 775, refunded_cents: 0 };
  db.payout = null;
  rpc.markRefundNeedsReview.mockResolvedValue({ outcome: "needs_review" });
});

describe("executeApprovedRefunds", () => {
  it("does nothing when nothing is approved", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([]);
    const s = await executeApprovedRefunds(null, 10);
    expect(s.claimed).toBe(0);
    expect(provider.createRefund).not.toHaveBeenCalled();
  });

  it("creates one idempotent Stripe refund and records it", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([refund]);
    provider.createRefund.mockResolvedValue({ refundId: "re_1", amountCents: 775, status: "succeeded" });
    const s = await executeApprovedRefunds("o_1", 5);
    expect(s.submitted).toBe(1);
    expect(provider.createRefund).toHaveBeenCalledWith(expect.objectContaining({
      paymentIntentId: "pi_1", amountCents: 775, idempotencyKey: "refund_rf_1", reason: "requested_by_customer",
    }));
    expect(rpc.markRefundSubmitted).toHaveBeenCalledWith(expect.objectContaining({ refundId: "rf_1", stripeRefundId: "re_1", reversalId: null }));
    expect(provider.reverseTransfer).not.toHaveBeenCalled();
  });

  it("reverses the seller's share first when the seller was already paid", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([refund]);
    db.payout = { id: "po_1", transfer_id: "tr_1", amount_cents: 661, reversed_cents: 0, status: "sent" };
    provider.reverseTransfer.mockResolvedValue({ reversalId: "trr_1", amountCents: 661 });
    provider.createRefund.mockResolvedValue({ refundId: "re_2", amountCents: 775, status: "pending" });
    const s = await executeApprovedRefunds("o_1", 5);
    expect(s.submitted).toBe(1);
    expect(provider.reverseTransfer).toHaveBeenCalledWith(expect.objectContaining({ transferId: "tr_1", amountCents: 661, idempotencyKey: "reversal_rf_1" }));
    expect(rpc.markPayoutReversed).toHaveBeenCalledWith(expect.objectContaining({ transferId: "tr_1", reversedCents: 661 }));
    // reversal happens before the refund
    expect(provider.reverseTransfer.mock.invocationCallOrder[0]).toBeLessThan(provider.createRefund.mock.invocationCallOrder[0]);
    expect(rpc.markRefundSubmitted).toHaveBeenCalledWith(expect.objectContaining({ reversalId: "trr_1", reversalCents: 661 }));
  });

  it("never refunds the buyer when the seller payout cannot be reclaimed", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([refund]);
    db.payout = { id: "po_1", transfer_id: "tr_1", amount_cents: 661, reversed_cents: 0, status: "sent" };
    provider.reverseTransfer.mockRejectedValue(new Error("insufficient funds in connected account"));
    const s = await executeApprovedRefunds("o_1", 5);
    expect(s.needs_review).toBe(1);
    expect(provider.createRefund).not.toHaveBeenCalled();
    expect(rpc.markRefundNeedsReview).toHaveBeenCalledWith("rf_1", expect.stringMatching(/Could not reclaim/));
    expect(ops.reportOpsAlert).toHaveBeenCalledWith(expect.objectContaining({ kind: "refund_needs_review", orderId: "o_1" }));
  });

  it("only reverses what is still reversible on a partial refund", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([{ ...refund, kind: "partial", amount_cents: 279, seller_share_cents: 279 }]);
    db.payout = { id: "po_1", transfer_id: "tr_1", amount_cents: 661, reversed_cents: 500, status: "sent" };
    provider.reverseTransfer.mockResolvedValue({ reversalId: "trr_2", amountCents: 161 });
    provider.createRefund.mockResolvedValue({ refundId: "re_3", amountCents: 279, status: "pending" });
    await executeApprovedRefunds("o_1", 5);
    expect(provider.reverseTransfer).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 161 }));
    expect(provider.createRefund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 279 }));
  });

  it("parks a refund with no PaymentIntent for review", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([refund]);
    db.payment = { payment_intent_id: null };
    const s = await executeApprovedRefunds("o_1", 5);
    expect(s.needs_review).toBe(1);
    expect(provider.createRefund).not.toHaveBeenCalled();
  });

  it("retries transient Stripe errors instead of parking them", async () => {
    rpc.claimApprovedRefunds.mockResolvedValue([refund]);
    provider.createRefund.mockRejectedValue(new Error("Stripe is temporarily unavailable"));
    rpc.markRefundNeedsReview.mockResolvedValue({ outcome: "approved" });
    const s = await executeApprovedRefunds("o_1", 5);
    expect(s.retry).toBe(1);
    expect(rpc.markRefundNeedsReview).toHaveBeenCalledWith("rf_1", expect.any(String), true);
    expect(ops.reportOpsAlert).not.toHaveBeenCalled();
  });
});
