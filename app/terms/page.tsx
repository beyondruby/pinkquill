"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "acceptance", label: "Acceptance" },
  { id: "eligibility", label: "Eligibility" },
  { id: "your-account", label: "Your Account" },
  { id: "your-content", label: "Your Content" },
  { id: "community-standards", label: "Community Standards" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "privacy", label: "Privacy" },
  { id: "interactions", label: "Interactions" },
  { id: "third-parties", label: "Third Parties" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "liability", label: "Liability" },
  { id: "termination", label: "Termination" },
  { id: "disputes", label: "Disputes" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  const lastUpdated = "January 3, 2026";
  const [activeSection, setActiveSection] = useState("acceptance");

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
              Terms & Conditions
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
              {tocItems.map(({ id, label }, i) => (
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
                PinkQuill is a sanctuary for creative expression. These terms exist to protect
                our community and ensure every creative can share their work in a safe,
                inspiring space.
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

            <Section id="acceptance" number="01" title="Acceptance of Terms">
              <p>
                By accessing PinkQuill, you agree to these Terms and our Privacy Policy.
                If you disagree with any part, please don't use our platform.
              </p>
              <p>
                These terms form a binding agreement between you and PinkQuill. Continued
                use after any modifications constitutes acceptance of those changes.
              </p>
            </Section>

            <Section id="eligibility" number="02" title="Eligibility">
              <p>
                You must be at least <strong>13 years old</strong> to use PinkQuill. If you're
                under 18, you need permission from a parent or guardian who agrees to
                these terms on your behalf.
              </p>
              <p>
                You must have the legal capacity to enter contracts in your jurisdiction
                and not be prohibited from using the service under applicable laws.
              </p>
            </Section>

            <Section id="your-account" number="03" title="Your Account">
              <p>
                When creating an account, provide accurate information and keep it
                current. Choose a username that doesn't infringe others' rights or
                impersonate anyone.
              </p>
              <p>
                You're responsible for your account's security. Keep your password
                confidential, never share access, and notify us immediately of any
                unauthorized use. You're responsible for all activity under your account.
              </p>
              <Highlight>
                PinkQuill will never ask for your password via email or message.
                Be cautious of phishing attempts.
              </Highlight>
            </Section>

            <Section id="your-content" number="04" title="Your Content">
              <p>
                <strong>You own your work.</strong> PinkQuill doesn't claim ownership of
                anything you create—your art, music, writing, photos, videos, and creative
                work remain yours.
              </p>
              <p>
                By posting, you grant us a license to host, display, and distribute
                your content on the platform according to your privacy settings. This
                license ends when you delete your content, except where it's been
                shared by others or retention is legally required.
              </p>
              <p>
                You represent that you own or have rights to everything you post, that
                it doesn't infringe anyone's rights, and that you've obtained necessary
                consents from anyone appearing in your content.
              </p>
            </Section>

            <Section id="community-standards" number="05" title="Community Standards">
              <p>
                PinkQuill is built on mutual respect. We ask that you contribute to a
                welcoming environment that supports fellow creators.
              </p>

              <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                Please don't post content that:
              </p>
              <ul>
                <li>Violates any law or promotes illegal activity</li>
                <li>Harasses, bullies, threatens, or demeans others</li>
                <li>Promotes violence, self-harm, or dangerous behavior</li>
                <li>Contains hate speech targeting protected groups</li>
                <li>Includes sexually explicit material or non-consensual imagery</li>
                <li>Exploits or endangers minors in any way</li>
                <li>Spreads harmful misinformation</li>
                <li>Contains spam, malware, or deceptive content</li>
              </ul>

              <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                Please don't:
              </p>
              <ul>
                <li>Create multiple accounts to evade restrictions</li>
                <li>Impersonate others or falsely claim affiliations</li>
                <li>Use bots or automated systems without permission</li>
                <li>Attempt unauthorized access to accounts or systems</li>
                <li>Manipulate engagement metrics artificially</li>
                <li>Circumvent blocks or other user restrictions</li>
              </ul>

              <p>
                For sensitive content that doesn't violate these terms, please use
                content warnings to help others make informed viewing choices.
              </p>
            </Section>

            <Section id="intellectual-property" number="06" title="Intellectual Property">
              <p>
                PinkQuill's design, features, and branding are protected by intellectual
                property laws. Please don't copy, modify, or distribute our platform
                without permission.
              </p>
              <p>
                Respect others' creative rights. Don't post content that infringes
                copyrights or trademarks unless you have permission or a legal basis
                like fair use.
              </p>

              <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                Copyright Claims (DMCA)
              </p>
              <p>
                If your work has been infringed, send a notice to{" "}
                <a href="mailto:dmca@pinkquill.app" className="text-purple-primary hover:underline">
                  dmca@pinkquill.app
                </a>{" "}
                containing: identification of the work, location of the infringement,
                your contact information, a good-faith statement, and your signature.
              </p>
              <p>
                We maintain a repeat infringer policy and will terminate accounts
                that repeatedly violate copyright.
              </p>
            </Section>

            <Section id="privacy" number="07" title="Privacy & Data">
              <p>
                Your privacy matters. Our{" "}
                <Link href="/privacy" className="text-purple-primary hover:underline">
                  Privacy Policy
                </Link>{" "}
                explains how we collect, use, and protect your information.
              </p>
              <p>
                We collect information you provide, data generated through usage, and
                information from connected services. We use this to provide, improve,
                and personalize your experience while ensuring safety and security.
              </p>
              <p>
                Depending on your location, you may have rights to access, correct,
                delete, or port your data. Many of these can be managed in your settings.
              </p>
            </Section>

            <Section id="interactions" number="08" title="Interactions">
              <p>
                <strong>Following</strong> — You can follow creators to see their work
                in your feed. Following is one-directional and doesn't create any
                obligation.
              </p>
              <p>
                <strong>Blocking</strong> — You can block anyone. Blocked users can't
                see your profile or content, and mutual follows are removed. Evading
                blocks through alternate accounts violates these terms.
              </p>
              <p>
                <strong>Reporting</strong> — Report content or users that violate these
                terms. We review reports and take appropriate action. False reports
                may result in action against the reporting account.
              </p>
              <p>
                <strong>Messaging</strong> — Use direct messages respectfully. Don't
                send spam or unsolicited commercial messages.
              </p>
            </Section>

            <Section id="third-parties" number="09" title="Third-Party Services">
              <p>
                PinkQuill may contain links to external sites or integrate with third-party
                services. We're not responsible for their content, policies, or practices.
                Your use of external services is subject to their own terms.
              </p>
            </Section>

            <Section id="disclaimers" number="10" title="Disclaimers">
              <p>
                PinkQuill is provided "as is" without warranties of any kind. We don't
                guarantee the service will be uninterrupted, secure, or error-free,
                or that any errors will be corrected.
              </p>
              <p>
                We don't control or endorse user content. Views expressed by users
                are their own. Content on PinkQuill is for creative and informational
                purposes—not professional advice.
              </p>
            </Section>

            <Section id="liability" number="11" title="Limitation of Liability">
              <p>
                To the maximum extent permitted by law, PinkQuill isn't liable for any
                indirect, incidental, special, or consequential damages—including
                loss of profits, data, or goodwill—arising from your use of the service.
              </p>
              <p>
                Our total liability is limited to the greater of amounts you've paid
                us in the past twelve months or one hundred dollars ($100).
              </p>
              <p>
                Some jurisdictions don't allow certain limitations. In those cases,
                our liability is limited to the maximum extent permitted by law.
              </p>
            </Section>

            <Section id="termination" number="12" title="Termination">
              <p>
                You can delete your account anytime in settings. Your profile and
                content will be removed, though content shared by others may persist,
                and some data may be retained for legal purposes.
              </p>
              <p>
                We may suspend or terminate accounts that violate these terms, harm
                the community, or for legal requirements—with or without notice.
              </p>
              <p>
                Upon termination, your right to use PinkQuill ends immediately. Provisions
                that should survive—like ownership, disclaimers, and limitations—will
                remain in effect.
              </p>
            </Section>

            <Section id="disputes" number="13" title="Dispute Resolution">
              <p>
                Before formal proceedings, please contact us to attempt informal
                resolution. We'll try to address your concern within 30 days.
              </p>
              <p>
                If informal resolution fails, disputes will be resolved through
                binding individual arbitration under AAA rules, not in court.
                You waive the right to participate in class actions.
              </p>
              <p>
                Exceptions: claims for injunctive relief, intellectual property
                disputes, and small claims court actions.
              </p>
              <p>
                These terms are governed by Delaware law, without regard to
                conflict of law provisions.
              </p>
            </Section>

            <Section id="changes" number="14" title="Changes to Terms">
              <p>
                We may update these terms. When we make material changes, we'll
                update the date above and notify you through the service or email.
              </p>
              <p>
                Continued use after changes take effect constitutes acceptance.
                If you disagree, please stop using PinkQuill.
              </p>
            </Section>

            <Section id="contact" number="15" title="Contact">
              <p>
                Questions about these terms? We're here to help.
              </p>
              <div className="mt-6 space-y-2">
                <p>
                  <span className="text-muted">General —</span>{" "}
                  <a href="mailto:hello@pinkquill.app" className="text-purple-primary hover:underline">
                    hello@pinkquill.app
                  </a>
                </p>
                <p>
                  <span className="text-muted">Legal —</span>{" "}
                  <a href="mailto:legal@pinkquill.app" className="text-purple-primary hover:underline">
                    legal@pinkquill.app
                  </a>
                </p>
                <p>
                  <span className="text-muted">Copyright —</span>{" "}
                  <a href="mailto:dmca@pinkquill.app" className="text-purple-primary hover:underline">
                    dmca@pinkquill.app
                  </a>
                </p>
              </div>
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
              Thank you for being part of our creative community.
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
            <Link href="/privacy" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="font-ui text-xs text-purple-primary">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .terms-section p {
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.85;
          color: #3d3d3d;
          margin-bottom: 1.25rem;
        }

        .terms-section p:last-child {
          margin-bottom: 0;
        }

        .terms-section strong {
          font-weight: 600;
          color: var(--ink);
        }

        .terms-section ul {
          margin: 1rem 0 1.25rem 0;
          padding: 0;
          list-style: none;
        }

        .terms-section li {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.75;
          color: #3d3d3d;
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
          position: relative;
        }

        .terms-section li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.7rem;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-purple), var(--vivid-pink));
        }

        .terms-section a {
          color: var(--primary-purple);
          text-decoration: none;
          transition: color 0.2s;
        }

        .terms-section a:hover {
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
    <section id={id} className="terms-section scroll-mt-24">
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
