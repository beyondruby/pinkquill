"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "introduction", label: "Introduction" },
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "how-we-use", label: "How We Use Your Data" },
  { id: "sharing", label: "Sharing Your Information" },
  { id: "your-choices", label: "Your Choices & Rights" },
  { id: "data-retention", label: "Data Retention" },
  { id: "security", label: "Security" },
  { id: "cookies", label: "Cookies & Tracking" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "children", label: "Children's Privacy" },
  { id: "international", label: "International Transfers" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
];

export default function PrivacyPage() {
  const lastUpdated = "January 3, 2026";
  const [activeSection, setActiveSection] = useState("introduction");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    tocItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-black/[0.04]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-ink transition-colors group"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-ui text-sm">Back</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-[680px] mx-auto text-center lg:ml-[280px] xl:mx-auto">
          <p className="font-ui text-[0.7rem] tracking-[0.2em] uppercase text-muted mb-6">
            Legal
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-normal mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              Privacy Policy
            </span>
          </h1>
          <p className="font-body text-lg text-muted/80 italic">
            Last updated {lastUpdated}
          </p>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="flex items-center justify-center gap-3 pb-16 lg:ml-[280px] xl:ml-0">
        <span className="w-12 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
        <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary/40" />
        <span className="w-12 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
      </div>

      <div className="flex max-w-5xl mx-auto px-6">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-[200px] flex-shrink-0">
          <nav className="sticky top-24">
            <p className="font-ui text-[0.6rem] tracking-[0.2em] uppercase text-muted/60 mb-4">
              On this page
            </p>
            <ul className="space-y-1">
              {tocItems.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`group flex items-center gap-2 py-1.5 text-sm transition-all duration-200 ${
                      activeSection === id
                        ? "text-purple-primary font-medium"
                        : "text-muted/70 hover:text-ink"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full transition-all duration-200 ${
                        activeSection === id
                          ? "bg-purple-primary scale-150"
                          : "bg-muted/30 group-hover:bg-muted"
                      }`}
                    />
                    <span className="font-body">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 pb-32 lg:pl-12">
          <article className="max-w-[680px]">

            {/* Preamble */}
            <div className="mb-16 text-center lg:text-left">
              <p className="font-body text-lg text-ink/70 leading-relaxed italic">
                Your privacy is fundamental to us. This policy explains how we collect,
                use, and protect your information when you use PinkQuill—because your
                creative work and personal data deserve respect.
              </p>
            </div>

            {/* Mobile Table of Contents */}
            <nav className="lg:hidden mb-20 py-8 border-y border-black/[0.06]">
              <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-muted mb-6 text-center">
                Contents
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-md mx-auto">
                {tocItems.map(({ id, label }, i) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="font-body text-sm text-muted hover:text-purple-primary transition-colors py-1 flex items-baseline gap-2"
                  >
                    <span className="text-[0.7rem] text-muted/50">{String(i + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                ))}
              </div>
            </nav>

            {/* Sections */}
            <div className="space-y-16">

              <Section id="introduction" number="01" title="Introduction">
                <p>
                  PinkQuill ("we," "our," or "us") is committed to protecting your privacy.
                  This Privacy Policy explains how we collect, use, disclose, and
                  safeguard your information when you use our platform.
                </p>
                <p>
                  By using PinkQuill, you consent to the practices described in this policy.
                  If you don't agree, please don't use our service.
                </p>
                <p>
                  This policy applies to all users of PinkQuill, including creators who
                  post content and visitors who browse the platform.
                </p>
              </Section>

              <Section id="information-we-collect" number="02" title="Information We Collect">
                <p>
                  We collect information in several ways to provide and improve our service.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Information you provide
                </p>
                <ul>
                  <li><strong>Account information</strong> — Email address, username, password, and display name when you register</li>
                  <li><strong>Profile information</strong> — Avatar, cover image, bio, tagline, location, website, and other details you choose to share</li>
                  <li><strong>Content</strong> — Posts, comments, messages, and any creative works you share</li>
                  <li><strong>Communications</strong> — Messages you send to other users or to us</li>
                  <li><strong>Payment information</strong> — If you make purchases, payment details processed by our payment providers</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Information collected automatically
                </p>
                <ul>
                  <li><strong>Usage data</strong> — Pages visited, features used, actions taken, time spent</li>
                  <li><strong>Device information</strong> — Browser type, operating system, device identifiers</li>
                  <li><strong>Location data</strong> — General location based on IP address</li>
                  <li><strong>Log data</strong> — IP address, access times, referring URLs, error logs</li>
                  <li><strong>Cookies</strong> — Small files stored on your device (see Cookies section)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Information from other sources
                </p>
                <ul>
                  <li><strong>Social logins</strong> — If you connect via third-party services, we receive information they share</li>
                  <li><strong>Other users</strong> — When others mention you, tag you, or share content involving you</li>
                </ul>
              </Section>

              <Section id="how-we-use" number="03" title="How We Use Your Data">
                <p>
                  We use your information to provide, maintain, and improve PinkQuill.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  To provide our service
                </p>
                <ul>
                  <li>Create and manage your account</li>
                  <li>Display your profile and content to others based on your settings</li>
                  <li>Enable interactions—following, messaging, commenting, reacting</li>
                  <li>Send notifications about activity relevant to you</li>
                  <li>Process transactions</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  To improve and personalize
                </p>
                <ul>
                  <li>Personalize your feed and recommendations</li>
                  <li>Analyze usage patterns to improve features</li>
                  <li>Develop new products and services</li>
                  <li>Conduct research and analytics</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  To keep PinkQuill safe
                </p>
                <ul>
                  <li>Detect and prevent fraud, abuse, and security threats</li>
                  <li>Enforce our Terms and community guidelines</li>
                  <li>Verify accounts and prevent unauthorized access</li>
                  <li>Respond to legal requests and protect rights</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  To communicate with you
                </p>
                <ul>
                  <li>Send service-related announcements</li>
                  <li>Respond to your inquiries and support requests</li>
                  <li>Send promotional communications (with your consent)</li>
                </ul>
              </Section>

              <Section id="sharing" number="04" title="Sharing Your Information">
                <p>
                  We don't sell your personal information. We share data only in these circumstances:
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  With your consent
                </p>
                <p>
                  When you explicitly agree to share information with third parties.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Public content
                </p>
                <p>
                  Content you post publicly is visible to other users and may be indexed
                  by search engines. Your profile information is visible according to your settings.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Service providers
                </p>
                <p>
                  We work with trusted partners who help us operate PinkQuill—hosting, analytics,
                  payment processing, customer support. They only access data necessary for
                  their services and are bound by confidentiality obligations.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Legal requirements
                </p>
                <p>
                  We may disclose information when required by law, legal process, or government
                  request, or to protect the rights, property, and safety of PinkQuill, our users,
                  or others.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Business transfers
                </p>
                <p>
                  If PinkQuill is involved in a merger, acquisition, or sale of assets, your
                  information may be transferred. We'll notify you of any change in ownership
                  or use of your data.
                </p>
              </Section>

              <Section id="your-choices" number="05" title="Your Choices & Rights">
                <p>
                  You have control over your information. Here's how to exercise your rights:
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Access and update
                </p>
                <p>
                  View and update your profile information anytime in Settings. You can download
                  a copy of your data by contacting us.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Delete your account
                </p>
                <p>
                  You can delete your account in Settings. This removes your profile, posts,
                  and personal data, though some information may persist in backups or be
                  retained for legal purposes.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Manage privacy settings
                </p>
                <ul>
                  <li>Control who can see your posts (public or private)</li>
                  <li>Block users you don't want interacting with you</li>
                  <li>Manage notification preferences</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Marketing communications
                </p>
                <p>
                  Opt out of promotional emails by clicking "unsubscribe" or adjusting
                  your notification settings. You'll still receive essential service communications.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Regional rights
                </p>
                <p>
                  Depending on your location, you may have additional rights under laws like
                  GDPR (EU), CCPA (California), or others—including rights to access, rectification,
                  erasure, data portability, and objection. Contact us to exercise these rights.
                </p>
              </Section>

              <Section id="data-retention" number="06" title="Data Retention">
                <p>
                  We keep your information only as long as necessary to provide our service
                  and fulfill the purposes described in this policy.
                </p>
                <ul>
                  <li><strong>Account data</strong> — Retained while your account is active</li>
                  <li><strong>Content</strong> — Retained until you delete it or your account</li>
                  <li><strong>Usage data</strong> — Generally retained for up to 2 years</li>
                  <li><strong>Legal obligations</strong> — Some data retained longer if required by law</li>
                </ul>
                <p>
                  When you delete your account, we remove your data within 30 days, except
                  for backups (deleted within 90 days) and data we must retain for legal
                  or legitimate business purposes.
                </p>
              </Section>

              <Section id="security" number="07" title="Security">
                <p>
                  We implement technical and organizational measures to protect your data:
                </p>
                <ul>
                  <li>Encryption of data in transit (TLS/SSL) and at rest</li>
                  <li>Secure password hashing</li>
                  <li>Regular security assessments and monitoring</li>
                  <li>Access controls limiting employee access to user data</li>
                  <li>Incident response procedures</li>
                </ul>
                <p>
                  However, no system is completely secure. We can't guarantee absolute
                  security, and you use PinkQuill at your own risk. Please use a strong,
                  unique password and protect your account credentials.
                </p>
                <Highlight>
                  If you discover a security vulnerability, please report it to{" "}
                  <a href="mailto:security@pinkquill.com">security@pinkquill.com</a>.
                  We appreciate responsible disclosure.
                </Highlight>
              </Section>

              <Section id="cookies" number="08" title="Cookies & Tracking">
                <p>
                  We use cookies and similar technologies to provide and improve our service.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Essential cookies
                </p>
                <p>
                  Required for basic functionality—authentication, security, preferences.
                  You can't opt out of these.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Analytics cookies
                </p>
                <p>
                  Help us understand how people use PinkQuill so we can improve. These collect
                  aggregated, anonymous data.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Preference cookies
                </p>
                <p>
                  Remember your settings and preferences for a better experience.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Managing cookies
                </p>
                <p>
                  Most browsers let you block or delete cookies. Note that disabling
                  cookies may affect functionality. You can also use browser "Do Not Track"
                  settings, though we currently don't respond to DNT signals.
                </p>
              </Section>

              <Section id="third-party" number="09" title="Third-Party Services">
                <p>
                  PinkQuill integrates with third-party services that have their own privacy practices:
                </p>
                <ul>
                  <li><strong>Supabase</strong> — Database and authentication infrastructure</li>
                  <li><strong>Cloud storage providers</strong> — Hosting for uploaded media</li>
                  <li><strong>Analytics services</strong> — Usage analysis and performance monitoring</li>
                  <li><strong>Payment processors</strong> — Secure payment handling</li>
                </ul>
                <p>
                  We encourage you to review their privacy policies. We're not responsible
                  for the practices of third-party services.
                </p>
                <p>
                  When you click links to external sites, you leave PinkQuill and are subject
                  to those sites' privacy policies.
                </p>
              </Section>

              <Section id="children" number="10" title="Children's Privacy">
                <p>
                  PinkQuill is not intended for children under 13. We don't knowingly collect
                  personal information from children under 13.
                </p>
                <p>
                  If you're a parent or guardian and believe your child has provided us
                  with personal information, please contact us at{" "}
                  <a href="mailto:privacy@pinkquill.com">privacy@pinkquill.com</a>. We'll promptly
                  delete such information.
                </p>
                <p>
                  Users between 13 and 18 should have parental permission to use PinkQuill.
                </p>
              </Section>

              <Section id="international" number="11" title="International Transfers">
                <p>
                  PinkQuill operates globally. Your information may be transferred to and
                  processed in countries other than your own, including the United States,
                  where data protection laws may differ.
                </p>
                <p>
                  When we transfer data internationally, we use appropriate safeguards
                  like Standard Contractual Clauses to protect your information.
                </p>
                <p>
                  By using PinkQuill, you consent to the transfer of your information to
                  countries outside your residence.
                </p>
              </Section>

              <Section id="changes" number="12" title="Changes to This Policy">
                <p>
                  We may update this Privacy Policy from time to time. When we make
                  material changes, we'll:
                </p>
                <ul>
                  <li>Update the "Last updated" date at the top</li>
                  <li>Notify you through the service, email, or other means</li>
                  <li>Give you an opportunity to review changes before they take effect</li>
                </ul>
                <p>
                  Your continued use of PinkQuill after changes become effective constitutes
                  acceptance. If you disagree, please stop using the service.
                </p>
              </Section>

              <Section id="contact" number="13" title="Contact Us">
                <p>
                  Questions, concerns, or requests regarding your privacy? We're here to help.
                </p>
                <div className="mt-6 space-y-2">
                  <p>
                    <span className="text-muted">Privacy inquiries —</span>{" "}
                    <a href="mailto:privacy@pinkquill.com" className="text-purple-primary hover:underline">
                      privacy@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Data requests —</span>{" "}
                    <a href="mailto:data@pinkquill.com" className="text-purple-primary hover:underline">
                      data@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Security issues —</span>{" "}
                    <a href="mailto:security@pinkquill.com" className="text-purple-primary hover:underline">
                      security@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">General —</span>{" "}
                    <a href="mailto:hello@pinkquill.com" className="text-purple-primary hover:underline">
                      hello@pinkquill.com
                    </a>
                  </p>
                </div>
                <p className="mt-6">
                  For EU residents, you also have the right to lodge a complaint with
                  your local data protection authority.
                </p>
              </Section>

            </div>

            {/* Closing */}
            <div className="mt-24 pt-16 border-t border-black/[0.06] text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                <span className="w-8 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
                <FontAwesomeIcon icon={faFeatherPointed} className="w-5 h-5 text-purple-primary/50" />
                <span className="w-8 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
              </div>
              <p className="font-body text-muted italic mb-8">
                Your trust means everything to us.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 font-ui text-sm text-purple-primary hover:text-pink-vivid transition-colors"
              >
                <FontAwesomeIcon icon={faFeatherPointed} className="w-3.5 h-3.5" />
                Return to PinkQuill
              </Link>
            </div>

          </article>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="font-ui text-xs text-muted/60">
            © {new Date().getFullYear()} PinkQuill
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-ui text-xs text-purple-primary">
              Privacy
            </Link>
            <Link href="/terms" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .privacy-section p {
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.85;
          color: #3d3d3d;
          margin-bottom: 1.25rem;
        }

        .privacy-section p:last-child {
          margin-bottom: 0;
        }

        .privacy-section strong {
          font-weight: 600;
          color: var(--ink);
        }

        .privacy-section ul {
          margin: 1rem 0 1.25rem 0;
          padding: 0;
          list-style: none;
        }

        .privacy-section li {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.75;
          color: #3d3d3d;
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
          position: relative;
        }

        .privacy-section li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.7rem;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-purple), var(--vivid-pink));
        }

        .privacy-section a {
          color: var(--primary-purple);
          text-decoration: none;
          transition: color 0.2s;
        }

        .privacy-section a:hover {
          color: var(--vivid-pink);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

function Section({
  id,
  number,
  title,
  children
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="privacy-section scroll-mt-24">
      <header className="mb-6">
        <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
          {number}
        </span>
        <h2 className="font-display text-2xl font-normal text-ink">
          {title}
        </h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 pl-5 border-l-2 border-purple-primary/30">
      <p className="font-body text-[0.95rem] text-muted italic !mb-0">
        {children}
      </p>
    </div>
  );
}
