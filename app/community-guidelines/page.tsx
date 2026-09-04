"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "introduction", label: "Introduction" },
  { id: "our-values", label: "Our Values" },
  { id: "be-respectful", label: "Be Respectful" },
  { id: "be-authentic", label: "Be Authentic" },
  { id: "be-safe", label: "Be Safe" },
  { id: "content-standards", label: "Content Standards" },
  { id: "prohibited-content", label: "Prohibited Content" },
  { id: "sensitive-content", label: "Sensitive Content" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "interactions", label: "Interactions & Engagement" },
  { id: "messaging", label: "Direct Messaging" },
  { id: "communities", label: "Communities" },
  { id: "collaboration", label: "Collaboration" },
  { id: "privacy-boundaries", label: "Privacy & Boundaries" },
  { id: "minors-safety", label: "Minors & Safety" },
  { id: "reporting", label: "Reporting & Blocking" },
  { id: "enforcement", label: "Enforcement" },
  { id: "appeals", label: "Appeals" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default function CommunityGuidelinesPage() {
  const lastUpdated = "February 2, 2026";
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
    <div className="min-h-screen bg-canvas">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-canvas/90 backdrop-blur-md border-b border-border-light">
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
          <p className="font-ui text-xs text-muted mb-6">
            Community
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-normal mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              Community Guidelines
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
            <p className="font-ui text-xs text-muted/60 mb-4">
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
                PinkQuill is a sanctuary for creative expression—a place where artists, writers,
                poets, and dreamers come together to share their work and inspire one another.
                These guidelines help us maintain a welcoming, supportive, and safe community
                for all.
              </p>
            </div>

            {/* Mobile Table of Contents */}
            <nav className="lg:hidden mb-20 py-8 border-y border-border-light">
              <p className="font-ui text-xs text-muted mb-6 text-center">
                Contents
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-md mx-auto">
                {tocItems.map(({ id, label }, i) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="font-body text-sm text-muted hover:text-accent transition-colors py-1 flex items-baseline gap-2"
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
                  Welcome to PinkQuill. We believe creativity flourishes in spaces built on
                  mutual respect, authenticity, and kindness. These Community Guidelines outline
                  how we expect everyone to behave and what content is welcome on our platform.
                </p>
                <p>
                  These guidelines apply to all content and interactions on PinkQuill—including
                  posts, comments, messages, profiles, communities, and any other features we
                  offer. They work alongside our{" "}
                  <Link href="/terms" className="text-purple-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-purple-primary hover:underline">
                    Privacy Policy
                  </Link>.
                </p>
                <p>
                  By using PinkQuill, you agree to follow these guidelines. Violations may
                  result in content removal, account restrictions, or permanent bans depending
                  on severity.
                </p>
                <Highlight>
                  Our goal isn&apos;t to restrict creativity—it&apos;s to ensure everyone can express
                  themselves without fear of harassment, harm, or exploitation.
                </Highlight>
              </Section>

              <Section id="our-values" number="02" title="Our Values">
                <p>
                  Everything at PinkQuill is built on four core values that guide our community:
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Creativity
                </p>
                <p>
                  We celebrate all forms of creative expression—poetry, prose, visual art,
                  photography, music, and everything in between. Every voice matters, and
                  every creative journey is valid.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Authenticity
                </p>
                <p>
                  We value genuine self-expression and honest connection. Be yourself, share
                  your true voice, and respect others doing the same.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Respect
                </p>
                <p>
                  Every person in our community deserves to be treated with dignity. We embrace
                  diverse perspectives, backgrounds, identities, and experiences.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Safety
                </p>
                <p>
                  Everyone should feel safe sharing their work and engaging with others.
                  We take harmful behavior seriously and act swiftly to protect our community.
                </p>
              </Section>

              <Section id="be-respectful" number="03" title="Be Respectful">
                <p>
                  Respect is the foundation of our community. Treat others the way you&apos;d
                  want to be treated—with kindness, empathy, and consideration.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Do
                </p>
                <ul>
                  <li>Engage thoughtfully with others&apos; creative work</li>
                  <li>Offer constructive feedback when asked</li>
                  <li>Celebrate others&apos; successes and milestones</li>
                  <li>Respect different opinions, styles, and perspectives</li>
                  <li>Use inclusive language that welcomes everyone</li>
                  <li>Acknowledge and credit inspirations and influences</li>
                  <li>Be patient with newer members of the community</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Don&apos;t
                </p>
                <ul>
                  <li>Harass, bully, intimidate, or threaten anyone</li>
                  <li>Attack someone&apos;s identity, background, or personal characteristics</li>
                  <li>Mock, ridicule, or demean others&apos; creative work</li>
                  <li>Engage in pile-ons or coordinated harassment</li>
                  <li>Share private information about others without consent (doxxing)</li>
                  <li>Make unwanted sexual advances or comments</li>
                  <li>Deliberately provoke or antagonize others (trolling)</li>
                  <li>Spam, flood, or disrupt conversations</li>
                </ul>

                <Highlight>
                  Disagreement is natural—even healthy. But there&apos;s a difference between
                  respectful debate and personal attacks. Focus on ideas, not individuals.
                </Highlight>
              </Section>

              <Section id="be-authentic" number="04" title="Be Authentic">
                <p>
                  Authenticity builds trust and meaningful connections. Be genuine in how
                  you present yourself and your work.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Identity
                </p>
                <ul>
                  <li>Use your real name or a consistent pseudonym—both are welcome</li>
                  <li>Don&apos;t impersonate other people, brands, or organizations</li>
                  <li>Don&apos;t create fake accounts to deceive others</li>
                  <li>Don&apos;t claim false credentials, affiliations, or achievements</li>
                  <li>One account per person (no duplicate accounts)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Content authenticity
                </p>
                <ul>
                  <li>Share your own original work</li>
                  <li>Credit others when sharing or building on their work</li>
                  <li>Don&apos;t claim others&apos; work as your own (plagiarism)</li>
                  <li>Be honest about AI-assisted or AI-generated content</li>
                  <li>Don&apos;t manipulate engagement artificially (fake likes, follow-for-follow schemes)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Transparency
                </p>
                <ul>
                  <li>Disclose sponsored content or paid partnerships</li>
                  <li>Be clear about commercial intent when promoting products</li>
                  <li>Don&apos;t use misleading tactics to gain followers or engagement</li>
                </ul>
              </Section>

              <Section id="be-safe" number="05" title="Be Safe">
                <p>
                  Safety is everyone&apos;s responsibility. Help us maintain a space where people
                  can create and connect without fear.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Protect yourself
                </p>
                <ul>
                  <li>Be cautious about sharing personal information publicly</li>
                  <li>Use strong, unique passwords for your account</li>
                  <li>Report suspicious accounts or messages</li>
                  <li>Trust your instincts—if something feels wrong, it probably is</li>
                  <li>Use privacy settings to control who sees your content</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Protect others
                </p>
                <ul>
                  <li>Don&apos;t share others&apos; personal information without consent</li>
                  <li>Report content that could endanger someone</li>
                  <li>Reach out if you&apos;re concerned about someone&apos;s wellbeing</li>
                  <li>Don&apos;t encourage dangerous or illegal behavior</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Crisis resources
                </p>
                <p>
                  If you or someone you know is in crisis, please reach out to professional
                  resources:
                </p>
                <ul>
                  <li><strong>Emergency:</strong> Call your local emergency number (911 in the US)</li>
                  <li><strong>Suicide Prevention:</strong> 988 (US) or your local crisis line</li>
                  <li><strong>Crisis Text Line:</strong> Text HOME to 741741 (US)</li>
                </ul>
              </Section>

              <Section id="content-standards" number="06" title="Content Standards">
                <p>
                  PinkQuill welcomes diverse creative expression. Here&apos;s what we encourage
                  and what makes great content on our platform.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  What we love to see
                </p>
                <ul>
                  <li>Original poetry, prose, essays, and creative writing</li>
                  <li>Visual art, photography, and mixed media</li>
                  <li>Thoughtful reflections, journal entries, and personal essays</li>
                  <li>Creative experiments and works in progress</li>
                  <li>Supportive feedback and meaningful engagement</li>
                  <li>Behind-the-scenes looks at creative processes</li>
                  <li>Discussions about craft, technique, and inspiration</li>
                  <li>Collaborations between creators</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Content quality
                </p>
                <p>
                  We don&apos;t judge the &quot;quality&quot; of your art—all creative expression is valid.
                  However, content should be:
                </p>
                <ul>
                  <li>Posted in good faith as creative expression or genuine engagement</li>
                  <li>Relevant to the communities and spaces where it&apos;s shared</li>
                  <li>Not spam, advertisements, or solely self-promotional</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Artistic freedom
                </p>
                <p>
                  We recognize that art often explores difficult themes—pain, darkness,
                  controversy, and the full spectrum of human experience. We allow content
                  that might be uncomfortable if it has artistic merit and doesn&apos;t violate
                  our prohibited content policies.
                </p>
              </Section>

              <Section id="prohibited-content" number="07" title="Prohibited Content">
                <p>
                  The following content is <strong>strictly prohibited</strong> on PinkQuill.
                  Posting this content will result in immediate removal and may lead to
                  account suspension or termination.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Violence & threats
                </p>
                <ul>
                  <li>Credible threats of violence against individuals or groups</li>
                  <li>Content that promotes, glorifies, or incites violence</li>
                  <li>Terrorist content or support for terrorist organizations</li>
                  <li>Instructions for carrying out violent acts</li>
                  <li>Graphic violence intended to shock or disturb (not artistic expression)</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Hate & discrimination
                </p>
                <ul>
                  <li>Content that attacks people based on race, ethnicity, national origin, religion, caste, sexual orientation, gender identity, disability, or serious disease</li>
                  <li>Slurs, dehumanizing language, or hate symbols</li>
                  <li>Content promoting hate groups or hateful ideologies</li>
                  <li>Denying or mocking historical atrocities or genocides</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Sexual exploitation & abuse
                </p>
                <ul>
                  <li>Child sexual abuse material (CSAM) — zero tolerance</li>
                  <li>Sexual content involving minors in any form</li>
                  <li>Non-consensual intimate imagery (&quot;revenge porn&quot;)</li>
                  <li>Sexual exploitation or trafficking content</li>
                  <li>Bestiality or zoophilia content</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Self-harm & suicide
                </p>
                <ul>
                  <li>Content that promotes or provides instructions for self-harm or suicide</li>
                  <li>Graphic depictions of self-harm intended to shock</li>
                  <li>Pro-eating disorder content that promotes harmful behaviors</li>
                </ul>
                <p>
                  <em>Note: Artistic exploration of mental health struggles, recovery journeys,
                  and personal experiences is allowed with appropriate content warnings.</em>
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Illegal activity
                </p>
                <ul>
                  <li>Content promoting illegal activities</li>
                  <li>Drug sales, trafficking, or manufacturing instructions</li>
                  <li>Weapons sales or instructions for creating weapons</li>
                  <li>Fraud schemes, scams, or deceptive practices</li>
                  <li>Hacking instructions or malware distribution</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Misinformation
                </p>
                <ul>
                  <li>Dangerous health misinformation that could cause harm</li>
                  <li>Election interference or voter suppression content</li>
                  <li>Manipulated media presented as authentic (deepfakes)</li>
                  <li>Coordinated disinformation campaigns</li>
                </ul>

                <Highlight>
                  When in doubt, err on the side of caution. If you&apos;re unsure whether
                  content is appropriate, use a content warning or reach out to us.
                </Highlight>
              </Section>

              <Section id="sensitive-content" number="08" title="Sensitive Content">
                <p>
                  Some content, while not prohibited, requires special consideration.
                  Use content warnings to help others make informed viewing choices.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  When to use content warnings
                </p>
                <ul>
                  <li>Discussions of mental health struggles, trauma, or abuse</li>
                  <li>Depictions of violence (even artistic or historical)</li>
                  <li>Mature themes including sexuality (non-explicit)</li>
                  <li>Content about death, grief, or loss</li>
                  <li>Strong language or profanity</li>
                  <li>Potentially triggering topics (eating disorders, addiction, etc.)</li>
                  <li>Political content that may be divisive</li>
                  <li>Flashing images or content that could affect photosensitive individuals</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  How to use content warnings
                </p>
                <p>
                  When creating a post with sensitive content, use PinkQuill&apos;s built-in
                  content warning feature. This hides the content behind a warning that
                  users must click to reveal. Be specific about the type of content
                  (e.g., &quot;CW: Discussion of grief&quot; rather than just &quot;CW&quot;).
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Nudity & mature content
                </p>
                <p>
                  Artistic nudity may be permitted in certain contexts:
                </p>
                <ul>
                  <li>Classical or fine art depicting the human form</li>
                  <li>Educational content about anatomy or art</li>
                  <li>Documentary photography</li>
                </ul>
                <p>
                  Pornographic content, sexually explicit material, and content created
                  primarily for sexual gratification is not permitted.
                </p>
              </Section>

              <Section id="intellectual-property" number="09" title="Intellectual Property">
                <p>
                  Respect for creative ownership is fundamental to our community.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Your rights
                </p>
                <p>
                  You retain full ownership of everything you create and share on PinkQuill.
                  We never claim ownership of your work. When you post content, you grant
                  us only the limited license needed to display and share it according to
                  your settings.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Respecting others&apos; work
                </p>
                <ul>
                  <li><strong>Always credit:</strong> If you&apos;re inspired by or referencing someone&apos;s work, give them credit</li>
                  <li><strong>Ask permission:</strong> Before using someone&apos;s work as a base for your own</li>
                  <li><strong>Don&apos;t plagiarize:</strong> Copying others&apos; work and claiming it as your own is never acceptable</li>
                  <li><strong>Understand fair use:</strong> Know the limits of fair use and transformative work</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Fan art & derivative works
                </p>
                <p>
                  Fan art and derivative works exist in a complex legal space. While many
                  creators welcome fan works, some do not. When creating fan art:
                </p>
                <ul>
                  <li>Research the original creator&apos;s stance on fan works</li>
                  <li>Credit the original work and creator</li>
                  <li>Don&apos;t sell fan art unless you have permission or proper licensing</li>
                  <li>Be prepared to remove content if requested by rights holders</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Reporting infringement
                </p>
                <p>
                  If your work has been used without permission, you can file a DMCA
                  takedown request at{" "}
                  <a href="mailto:dmca@pinkquill.com" className="text-purple-primary hover:underline">
                    dmca@pinkquill.com
                  </a>.
                </p>
              </Section>

              <Section id="interactions" number="10" title="Interactions & Engagement">
                <p>
                  Meaningful interactions make our community special. Here&apos;s how to engage
                  in ways that lift everyone up.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Comments & reactions
                </p>
                <ul>
                  <li>Leave thoughtful comments that add to the conversation</li>
                  <li>Use reactions to show appreciation (admire, snap, ovation, etc.)</li>
                  <li>Offer constructive criticism only when invited or appropriate</li>
                  <li>Avoid drive-by negativity or empty criticism</li>
                  <li>Remember there&apos;s a person behind every post</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Following & feeds
                </p>
                <ul>
                  <li>Follow creators whose work resonates with you</li>
                  <li>Don&apos;t follow-then-unfollow to game the system</li>
                  <li>Curate your feed thoughtfully for your wellbeing</li>
                  <li>Use mute and block features to manage your experience</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Relays (sharing)
                </p>
                <ul>
                  <li>Relay work you genuinely appreciate to share with your followers</li>
                  <li>The original creator is always credited</li>
                  <li>Don&apos;t relay content to mock or ridicule it</li>
                  <li>Respect creators who don&apos;t want their work shared widely</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Mentions & tags
                </p>
                <ul>
                  <li>Only mention people when it&apos;s relevant to them</li>
                  <li>Don&apos;t use mentions to harass, spam, or draw negative attention</li>
                  <li>Ask permission before tagging someone in potentially sensitive content</li>
                </ul>
              </Section>

              <Section id="messaging" number="11" title="Direct Messaging">
                <p>
                  Direct messages are for meaningful one-on-one connections. Use them
                  respectfully.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Good messaging practices
                </p>
                <ul>
                  <li>Introduce yourself when messaging someone new</li>
                  <li>Be respectful of people&apos;s time and attention</li>
                  <li>Accept &quot;no&quot; gracefully if someone declines to engage</li>
                  <li>Keep conversations consensual—don&apos;t persist if someone stops responding</li>
                  <li>Use messages for genuine connection, not just self-promotion</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Prohibited messaging behavior
                </p>
                <ul>
                  <li>Sending unsolicited sexual or romantic content</li>
                  <li>Harassment via repeated unwanted messages</li>
                  <li>Spam or bulk promotional messages</li>
                  <li>Requests for personal information, money, or inappropriate content</li>
                  <li>Threats, intimidation, or abusive language</li>
                  <li>Circumventing blocks through alternate accounts</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Message requests
                </p>
                <p>
                  Messages from people you don&apos;t follow go to your message requests.
                  You can choose to accept, ignore, or report them. You&apos;re never obligated
                  to respond to anyone.
                </p>
              </Section>

              <Section id="communities" number="12" title="Communities">
                <p>
                  Communities are spaces for creators with shared interests to connect.
                  They have their own rules in addition to platform-wide guidelines.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Joining communities
                </p>
                <ul>
                  <li>Read and follow each community&apos;s specific rules</li>
                  <li>Contribute meaningfully to discussions</li>
                  <li>Stay on topic for the community&apos;s focus</li>
                  <li>Respect moderators and their decisions</li>
                  <li>Report rule violations to community moderators</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Creating & moderating communities
                </p>
                <ul>
                  <li>Establish clear, reasonable rules for your community</li>
                  <li>Enforce rules consistently and fairly</li>
                  <li>Don&apos;t create communities for prohibited content or purposes</li>
                  <li>Respond to reports and maintain community health</li>
                  <li>Build inclusive spaces that welcome diverse members</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Community rules
                </p>
                <p>
                  Community-specific rules cannot override PinkQuill&apos;s Community Guidelines.
                  If a community rule conflicts with our guidelines, our guidelines take
                  precedence. Communities that consistently violate guidelines may be removed.
                </p>
              </Section>

              <Section id="collaboration" number="13" title="Collaboration">
                <p>
                  Collaboration is one of the most rewarding aspects of creative communities.
                  Here&apos;s how to collaborate respectfully.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Collaboration invitations
                </p>
                <ul>
                  <li>Only invite people who might genuinely be interested</li>
                  <li>Clearly explain the collaboration and expectations</li>
                  <li>Accept declinations gracefully</li>
                  <li>Don&apos;t pressure or guilt people into collaborating</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Working together
                </p>
                <ul>
                  <li>Communicate clearly about roles, credit, and ownership</li>
                  <li>Agree on how the work will be shared and attributed</li>
                  <li>Respect deadlines and commitments</li>
                  <li>Give and receive feedback constructively</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Credit & attribution
                </p>
                <ul>
                  <li>Always credit all collaborators on shared work</li>
                  <li>Use PinkQuill&apos;s collaboration features to properly attribute</li>
                  <li>Don&apos;t remove or diminish others&apos; contributions</li>
                  <li>Resolve attribution disputes privately and respectfully</li>
                </ul>
              </Section>

              <Section id="privacy-boundaries" number="14" title="Privacy & Boundaries">
                <p>
                  Everyone has the right to set boundaries and control their own information.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Respecting privacy
                </p>
                <ul>
                  <li>Don&apos;t share others&apos; personal information without explicit consent</li>
                  <li>Don&apos;t screenshot and share private conversations</li>
                  <li>Respect when someone uses a pseudonym or keeps details private</li>
                  <li>Don&apos;t attempt to identify anonymous or pseudonymous users</li>
                  <li>Don&apos;t stalk or track people across platforms</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Setting your own boundaries
                </p>
                <ul>
                  <li>Use privacy settings to control who sees your content</li>
                  <li>Block accounts that make you uncomfortable</li>
                  <li>You don&apos;t owe anyone access to you or your work</li>
                  <li>It&apos;s okay to decline requests, comments, or messages</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Account privacy options
                </p>
                <p>
                  PinkQuill offers various privacy controls:
                </p>
                <ul>
                  <li><strong>Private account:</strong> Only approved followers see your posts</li>
                  <li><strong>Blocking:</strong> Prevent specific users from seeing or interacting with you</li>
                  <li><strong>Message filtering:</strong> Control who can message you</li>
                  <li><strong>Comment controls:</strong> Manage who can comment on your posts</li>
                </ul>
              </Section>

              <Section id="minors-safety" number="15" title="Minors & Safety">
                <p>
                  PinkQuill is for users 13 and older. We take the safety of young users
                  extremely seriously.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Age requirements
                </p>
                <ul>
                  <li>You must be at least 13 years old to use PinkQuill</li>
                  <li>Users 13-17 should have parental permission</li>
                  <li>Some features may be restricted for users under 18</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Protecting minors
                </p>
                <ul>
                  <li>Never share sexual or inappropriate content with minors</li>
                  <li>Don&apos;t solicit personal information from minors</li>
                  <li>Don&apos;t engage in grooming behavior</li>
                  <li>Report any concerning interactions with or about minors</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Zero tolerance
                </p>
                <p>
                  We have <strong>absolute zero tolerance</strong> for child sexual abuse
                  material (CSAM), sexual exploitation of minors, or any content that sexualizes
                  children. Such content is immediately removed and reported to the National
                  Center for Missing & Exploited Children (NCMEC) and law enforcement.
                </p>
              </Section>

              <Section id="reporting" number="16" title="Reporting & Blocking">
                <p>
                  You play a crucial role in keeping our community safe. Here&apos;s how to
                  report problems and protect yourself.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  When to report
                </p>
                <ul>
                  <li>Content that violates these Community Guidelines</li>
                  <li>Harassment or abuse directed at you or others</li>
                  <li>Spam or scam accounts</li>
                  <li>Impersonation of you or someone you know</li>
                  <li>Content that may endanger someone&apos;s safety</li>
                  <li>Intellectual property theft</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  How to report
                </p>
                <p>
                  Use the report feature (three dots menu → Report) on any post, comment,
                  message, or profile. Select the appropriate reason and provide any
                  additional context that might help us review the report.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  What happens after reporting
                </p>
                <ul>
                  <li>Reports are reviewed by our Trust & Safety team</li>
                  <li>We may contact you for additional information</li>
                  <li>We&apos;ll notify you of the outcome when appropriate</li>
                  <li>Your identity is kept confidential from the reported user</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Blocking
                </p>
                <p>
                  You can block anyone at any time. When you block someone:
                </p>
                <ul>
                  <li>They can&apos;t see your profile or posts</li>
                  <li>They can&apos;t message you or comment on your work</li>
                  <li>You won&apos;t see their content</li>
                  <li>Any mutual follows are removed</li>
                </ul>

                <Highlight>
                  False reports waste our resources and may result in action against your
                  account. Only report genuine violations.
                </Highlight>
              </Section>

              <Section id="enforcement" number="17" title="Enforcement">
                <p>
                  We enforce these guidelines to maintain a healthy community. Here&apos;s how
                  our enforcement process works.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  How we review content
                </p>
                <ul>
                  <li>Automated systems flag potentially violating content</li>
                  <li>Human reviewers make final decisions on flagged content</li>
                  <li>We consider context, intent, and artistic merit</li>
                  <li>We apply guidelines consistently across all users</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Enforcement actions
                </p>
                <ul>
                  <li><strong>Warning:</strong> A notice that content or behavior violated guidelines</li>
                  <li><strong>Content removal:</strong> Violating content is deleted</li>
                  <li><strong>Feature restrictions:</strong> Limited access to certain features (commenting, messaging, etc.)</li>
                  <li><strong>Temporary suspension:</strong> Account temporarily disabled</li>
                  <li><strong>Permanent ban:</strong> Account permanently removed from platform</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Factors we consider
                </p>
                <ul>
                  <li>Severity of the violation</li>
                  <li>Whether it&apos;s a first offense or repeated behavior</li>
                  <li>Intent behind the content or action</li>
                  <li>Potential for harm</li>
                  <li>Account history and standing</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Immediate action
                </p>
                <p>
                  Some violations result in immediate permanent bans without warning:
                </p>
                <ul>
                  <li>Child sexual abuse material</li>
                  <li>Credible threats of violence</li>
                  <li>Terrorist content</li>
                  <li>Doxxing or non-consensual intimate imagery</li>
                  <li>Severe harassment campaigns</li>
                </ul>
              </Section>

              <Section id="appeals" number="18" title="Appeals">
                <p>
                  If you believe we made a mistake in an enforcement action, you can appeal.
                </p>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  How to appeal
                </p>
                <ul>
                  <li>Submit an appeal within 30 days of the enforcement action</li>
                  <li>Use the appeal link in your notification or email</li>
                  <li>Explain clearly why you believe the decision was incorrect</li>
                  <li>Provide any relevant context we may have missed</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  Appeal review
                </p>
                <ul>
                  <li>Appeals are reviewed by a different team member than the original decision</li>
                  <li>We aim to respond within 7-14 business days</li>
                  <li>Our decision on the appeal is final</li>
                </ul>

                <p className="font-ui text-sm tracking-wide text-ink mt-8 mb-4">
                  What we consider
                </p>
                <ul>
                  <li>New information not available in the original review</li>
                  <li>Context that changes the interpretation</li>
                  <li>Errors in our original assessment</li>
                  <li>Artistic or educational merit we may have overlooked</li>
                </ul>

                <p>
                  For appeals, contact{" "}
                  <a href="mailto:appeals@pinkquill.com" className="text-purple-primary hover:underline">
                    appeals@pinkquill.com
                  </a>{" "}
                  with your username and details about the enforcement action.
                </p>
              </Section>

              <Section id="changes" number="19" title="Changes to Guidelines">
                <p>
                  These guidelines may be updated as our community evolves and new situations
                  arise.
                </p>
                <ul>
                  <li>Significant changes will be announced in advance</li>
                  <li>The &quot;Last updated&quot; date at the top reflects the most recent revision</li>
                  <li>We may notify you of major changes via email or in-app notification</li>
                  <li>Continued use of PinkQuill after changes constitutes acceptance</li>
                </ul>
                <p>
                  We encourage you to review these guidelines periodically. If you disagree
                  with changes, you may close your account.
                </p>
              </Section>

              <Section id="contact" number="20" title="Contact">
                <p>
                  Have questions about these guidelines or need to report something?
                  We&apos;re here to help.
                </p>
                <div className="mt-6 space-y-2">
                  <p>
                    <span className="text-muted">General questions —</span>{" "}
                    <a href="mailto:community@pinkquill.com" className="text-purple-primary hover:underline">
                      community@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Report violations —</span>{" "}
                    <a href="mailto:report@pinkquill.com" className="text-purple-primary hover:underline">
                      report@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Appeals —</span>{" "}
                    <a href="mailto:appeals@pinkquill.com" className="text-purple-primary hover:underline">
                      appeals@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Trust & Safety —</span>{" "}
                    <a href="mailto:safety@pinkquill.com" className="text-purple-primary hover:underline">
                      safety@pinkquill.com
                    </a>
                  </p>
                  <p>
                    <span className="text-muted">Copyright (DMCA) —</span>{" "}
                    <a href="mailto:dmca@pinkquill.com" className="text-purple-primary hover:underline">
                      dmca@pinkquill.com
                    </a>
                  </p>
                </div>
                <p className="mt-6">
                  For urgent safety concerns, use the in-app report feature for fastest
                  response. In emergencies involving immediate danger, contact local
                  law enforcement.
                </p>
              </Section>

            </div>

            {/* Closing */}
            <div className="mt-24 pt-16 border-t border-border-light text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                <span className="w-8 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
                <FontAwesomeIcon icon={faFeatherPointed} className="w-5 h-5 text-purple-primary/50" />
                <span className="w-8 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
              </div>
              <p className="font-body text-muted italic mb-8">
                Together, we create the community we want to be part of.
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
      <footer className="border-t border-border-light py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="font-ui text-xs text-muted/60">
            © {new Date().getFullYear()} PinkQuill
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-ui text-xs text-muted/60 hover:text-accent transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="font-ui text-xs text-muted/60 hover:text-accent transition-colors">
              Terms
            </Link>
            <Link href="/community-guidelines" className="font-ui text-xs text-purple-primary">
              Community
            </Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .community-section p {
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.85;
          color: #3d3d3d;
          margin-bottom: 1.25rem;
        }

        .community-section p:last-child {
          margin-bottom: 0;
        }

        .community-section strong {
          font-weight: 600;
          color: var(--ink);
        }

        .community-section em {
          font-style: italic;
        }

        .community-section ul,
        .community-section ol {
          margin: 1rem 0 1.25rem 0;
          padding: 0;
          list-style: none;
        }

        .community-section li {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.75;
          color: #3d3d3d;
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
          position: relative;
        }

        .community-section ul li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.7rem;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-purple), var(--vivid-pink));
        }

        .community-section ol {
          counter-reset: list-counter;
        }

        .community-section ol li {
          counter-increment: list-counter;
        }

        .community-section ol li::before {
          content: counter(list-counter) ".";
          position: absolute;
          left: 0;
          font-weight: 600;
          color: var(--primary-purple);
        }

        .community-section a {
          color: var(--primary-purple);
          text-decoration: none;
          transition: color 0.2s;
        }

        .community-section a:hover {
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
    <section id={id} className="community-section scroll-mt-24">
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
    <div className="my-6 rounded-2xl border border-border-light bg-purple-primary/[0.04] px-5 py-4">
      <p className="font-body text-[0.95rem] text-muted italic !mb-0">
        {children}
      </p>
    </div>
  );
}
