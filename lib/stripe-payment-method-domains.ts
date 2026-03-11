import type Stripe from "stripe";

const paymentMethodDomainRegistrationCache = new Set<string>();

export interface PaymentMethodDomainRegistrationResult {
  domain: string;
  id: string | null;
  status: "registered" | "updated" | "already_registered" | "validation_failed";
  enabled: boolean;
  apple_pay_status: string | null;
  google_pay_status: string | null;
  link_status: string | null;
}

export function normalizeDomainCandidate(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;

  const host = value.split(",")[0].trim().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") return null;
  if (!host.includes(".")) return null;
  return host;
}

export function collectPaymentMethodDomains(request?: Request): string[] {
  const configuredDomains = (
    process.env.STRIPE_PAYMENT_METHOD_DOMAINS
    || process.env.STRIPE_APPLE_PAY_DOMAINS
    || ""
  )
    .split(",")
    .map((domain) => normalizeDomainCandidate(domain))
    .filter((domain): domain is string => Boolean(domain));

  const requestHost = request
    ? normalizeDomainCandidate(
      request.headers.get("x-forwarded-host") || request.headers.get("host")
    )
    : null;

  const siteHost = normalizeDomainCandidate(
    process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
      : null
  );

  const baseHosts = new Set<string>([
    ...configuredDomains,
    ...(requestHost ? [requestHost] : []),
    ...(siteHost ? [siteHost] : []),
  ]);

  const finalHosts = new Set<string>();
  for (const host of baseHosts) {
    finalHosts.add(host);
    if (host.startsWith("www.")) {
      finalHosts.add(host.slice(4));
    } else {
      finalHosts.add(`www.${host}`);
    }
  }

  return Array.from(finalHosts).filter((host) => normalizeDomainCandidate(host) !== null);
}

function toRegistrationResult(
  paymentMethodDomain: Stripe.PaymentMethodDomain,
  status: PaymentMethodDomainRegistrationResult["status"]
): PaymentMethodDomainRegistrationResult {
  return {
    domain: paymentMethodDomain.domain_name,
    id: paymentMethodDomain.id,
    status,
    enabled: paymentMethodDomain.enabled,
    apple_pay_status: paymentMethodDomain.apple_pay?.status || null,
    google_pay_status: paymentMethodDomain.google_pay?.status || null,
    link_status: paymentMethodDomain.link?.status || null,
  };
}

async function findExistingPaymentMethodDomain(
  stripe: Stripe,
  domain: string
): Promise<Stripe.PaymentMethodDomain | null> {
  const response = await stripe.paymentMethodDomains.list({ domain_name: domain });
  return response.data.find((item) => item.domain_name === domain) || null;
}

async function validatePaymentMethodDomain(
  stripe: Stripe,
  paymentMethodDomain: Stripe.PaymentMethodDomain
): Promise<Stripe.PaymentMethodDomain> {
  return stripe.paymentMethodDomains.validate(paymentMethodDomain.id);
}

export async function ensurePaymentMethodDomainsRegistered(
  stripe: Stripe,
  domains: string[]
): Promise<PaymentMethodDomainRegistrationResult[]> {
  const results: PaymentMethodDomainRegistrationResult[] = [];

  for (const domain of domains) {
    if (paymentMethodDomainRegistrationCache.has(domain)) continue;

    try {
      let paymentMethodDomain = await findExistingPaymentMethodDomain(stripe, domain);
      let resultStatus: PaymentMethodDomainRegistrationResult["status"] = "already_registered";

      if (!paymentMethodDomain) {
        paymentMethodDomain = await stripe.paymentMethodDomains.create({
          domain_name: domain,
          enabled: true,
        });
        resultStatus = "registered";
      } else if (!paymentMethodDomain.enabled) {
        paymentMethodDomain = await stripe.paymentMethodDomains.update(paymentMethodDomain.id, {
          enabled: true,
        });
        resultStatus = "updated";
      }

      try {
        paymentMethodDomain = await validatePaymentMethodDomain(stripe, paymentMethodDomain);
      } catch {
        results.push(toRegistrationResult(paymentMethodDomain, "validation_failed"));
        continue;
      }

      paymentMethodDomainRegistrationCache.add(domain);
      results.push(toRegistrationResult(paymentMethodDomain, resultStatus));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to register payment method domain";
      throw new Error(`${domain}: ${message}`);
    }
  }

  return results;
}
