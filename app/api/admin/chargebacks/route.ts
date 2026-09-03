/**
 * Chargeback evidence → Stripe (Phase 2f).
 *   POST { dispute_id, text: {...Stripe text fields}, files: [{ path, field }], submit: boolean, dry_run?: boolean }
 * Files come from the order-files bucket (the evidence items' attachments),
 * are uploaded to Stripe as dispute_evidence, then the dispute is updated.
 * `submit: true` sends it to the card network — irreversible — so the UI
 * confirms first. `dry_run` returns the payload without calling Stripe.
 * Not a money path: nothing here moves funds; the webhook keeps recording
 * the dispute's outcome as before.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { enforceSameOrigin, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getStripeServer } from "@/lib/stripe";
import { requireAdmin } from "@/lib/admin-server";
import { loadDisputePack } from "@/lib/admin/dispute-pack";
import { isEvidenceFileField, normalizeEvidenceText, type EvidenceFileField } from "@/lib/admin/chargeback-evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "order-files";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // Stripe's dispute evidence limit per file

interface Body {
  dispute_id?: string;
  text?: Record<string, unknown>;
  files?: Array<{ path?: string; field?: string }>;
  submit?: boolean;
  dry_run?: boolean;
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const parsed = await safeJsonParse<Body>(request);
  if ("error" in parsed) return parsed.error;
  const { dispute_id, text, files = [], submit = false, dry_run = false } = parsed.data;
  if (!dispute_id) return NextResponse.json({ error: "dispute_id is required" }, { status: 400 });

  const loaded = await loadDisputePack(dispute_id);
  if (!loaded) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  const { dispute, pack } = loaded;
  if (dispute.kind !== "chargeback" || !dispute.stripe_dispute_id) return NextResponse.json({ error: "Only chargebacks are answered through Stripe" }, { status: 400 });
  if (!["open", "under_review", "escalated"].includes(dispute.status)) return NextResponse.json({ error: "This chargeback is closed" }, { status: 400 });

  // Only files that were attached as evidence on this dispute may be sent.
  const allowedPaths = new Set(pack.evidenceItems.flatMap((e) => e.attachments.map((a) => a.path)));
  const picked: Array<{ path: string; field: EvidenceFileField; name: string; type?: string }> = [];
  const usedFields = new Set<string>();
  for (const f of files) {
    if (!f.path || !allowedPaths.has(f.path)) return NextResponse.json({ error: `File is not part of this dispute's evidence: ${f.path ?? "?"}` }, { status: 400 });
    const field = f.field ?? "uncategorized_file";
    if (!isEvidenceFileField(field)) return NextResponse.json({ error: `Unknown evidence field ${field}` }, { status: 400 });
    if (usedFields.has(field)) return NextResponse.json({ error: `Stripe accepts one file per field; ${field} is used twice` }, { status: 400 });
    usedFields.add(field);
    const meta = pack.evidenceItems.flatMap((e) => e.attachments).find((a) => a.path === f.path);
    picked.push({ path: f.path, field, name: meta?.name ?? f.path.split("/").pop() ?? "evidence", type: meta?.type });
  }

  const evidence: Stripe.DisputeUpdateParams.Evidence = { ...normalizeEvidenceText(text) };
  if (dry_run) return NextResponse.json({ dry_run: true, stripe_dispute_id: dispute.stripe_dispute_id, evidence, files: picked.map((p) => ({ path: p.path, field: p.field })), submit });

  const stripe = getStripeServer();
  const uploaded: Array<{ path: string; field: string; file_id: string }> = [];
  for (const p of picked) {
    const { data: blob, error } = await supabaseAdmin.storage.from(BUCKET).download(p.path);
    if (error || !blob) return NextResponse.json({ error: `Could not read ${p.name}: ${error?.message ?? "empty"}` }, { status: 400 });
    if (blob.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${p.name} is over Stripe's 5 MB evidence limit` }, { status: 400 });
    const file = await stripe.files.create({
      purpose: "dispute_evidence",
      file: { data: Buffer.from(await blob.arrayBuffer()), name: p.name, type: p.type ?? blob.type ?? "application/octet-stream" },
    });
    (evidence as Record<string, unknown>)[p.field] = file.id;
    uploaded.push({ path: p.path, field: p.field, file_id: file.id });
  }

  let updated: Stripe.Dispute;
  try {
    updated = await stripe.disputes.update(dispute.stripe_dispute_id, { evidence, submit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe rejected the evidence";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const item = {
    by: gate.user.id, role: "admin", at: new Date().toISOString(),
    text: `${submit ? "Evidence submitted to the card network" : "Evidence saved to Stripe as a draft"} (${Object.keys(evidence).length} field${Object.keys(evidence).length === 1 ? "" : "s"}, ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}). Stripe status: ${updated.status}.`,
    attachments: [],
    stripe: { submitted: submit, status: updated.status, fields: Object.keys(evidence), files: uploaded },
  };
  await supabaseAdmin.from("disputes").update({
    evidence: [...(dispute.evidence ?? []), item],
    stripe_status: updated.status,
    status: dispute.status === "open" ? "under_review" : dispute.status,
    updated_at: new Date().toISOString(),
  }).eq("id", dispute.id);
  await supabaseAdmin.rpc("admin_log", {
    p_admin_id: gate.user.id, p_action: submit ? "chargeback_evidence_submitted" : "chargeback_evidence_saved",
    p_context: { dispute_id: dispute.id, stripe_dispute_id: dispute.stripe_dispute_id, fields: Object.keys(evidence), files: uploaded.length, stripe_status: updated.status },
    p_order_id: dispute.order_id,
  });
  return NextResponse.json({ success: true, submitted: submit, stripe_status: updated.status, evidence_details: updated.evidence_details, files: uploaded });
}
