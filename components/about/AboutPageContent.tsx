"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "mission", label: "Our Mission" },
  { id: "ownership", label: "Your Work" },
  { id: "community", label: "Community" },
  { id: "values", label: "Our Values" },
  { id: "for-you", label: "Built For You" },
  { id: "join", label: "Join Us" },
];

export default function AboutPageContent() {
  const [activeSection, setActiveSection] = useState("mission");

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
            About
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-normal mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              A home for
            </span>
            <br />
            <span className="text-ink">those who create</span>
          </h1>
          <p className="font-body text-lg text-muted/80 italic">
            Built by creatives, for creatives
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
                PinkQuill is the social platform where your creativity takes center stage.
                No algorithms deciding your worth. No ads interrupting your flow.
                Just pure creative expression and a community that actually cares.
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

            {/* Hero Image */}
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-16">
              <Image
                src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=2671&auto=format&fit=crop"
                alt="Artist at work"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Sections */}
            <div className="space-y-24">

              {/* Mission Section */}
              <section id="mission" className="about-section scroll-mt-24">
                <header className="mb-6">
                  <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
                    01
                  </span>
                  <h2 className="font-display text-2xl font-normal text-ink">
                    Our Mission
                  </h2>
                </header>
                <div>
                  <p>
                    We believe every creative deserves a platform that respects their work,
                    protects their voice, and connects them with people who truly appreciate
                    what they do.
                  </p>
                  <p>
                    The internet wasn't built for creatives. It was built for advertisers.
                    Algorithms decide what gets seen. Engagement metrics define worth.
                    Your art becomes content to be monetized, not expression to be celebrated.
                  </p>
                  <p>
                    We're building something different. PinkQuill is a sanctuary where
                    musicians, visual artists, photographers, filmmakers, dancers, actors,
                    models, designers—anyone who creates—can share their work without
                    compromise. Where community means support, not competition.
                  </p>
                </div>
              </section>

              {/* Ownership Section */}
              <section id="ownership" className="about-section scroll-mt-24">
                <header className="mb-6">
                  <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
                    02
                  </span>
                  <h2 className="font-display text-2xl font-normal text-ink">
                    Your Work, Your Rules
                  </h2>
                </header>

                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-8">
                  <Image
                    src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=2680&auto=format&fit=crop"
                    alt="Creative expression"
                    fill
                    className="object-cover"
                  />
                </div>

                <div>
                  <p>
                    <strong>You own everything you create.</strong> We're just here to help you share it.
                  </p>
                  <p>
                    Your art stays yours. No hidden clauses, no rights grabs.
                    When you post on PinkQuill, you retain full ownership
                    of your work—always.
                  </p>
                  <p>
                    Share poems, music, photography, films, choreography, portfolios,
                    or whatever form your creativity takes. Eleven post types designed
                    for different expressions. Every medium has a home here.
                  </p>
                </div>

                <div className="my-8 pl-5 border-l-2 border-purple-primary/30">
                  <p className="font-body text-[0.95rem] text-muted italic !mb-0">
                    "Create freely knowing your work and your identity are protected.
                    Your voice matters here."
                  </p>
                </div>
              </section>

              {/* Community Section */}
              <section id="community" className="about-section scroll-mt-24">
                <header className="mb-6">
                  <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
                    03
                  </span>
                  <h2 className="font-display text-2xl font-normal text-ink">
                    Community Over Competition
                  </h2>
                </header>

                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-8">
                  <Image
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2670&auto=format&fit=crop"
                    alt="Creative collaboration"
                    fill
                    className="object-cover"
                  />
                </div>

                <div>
                  <p>
                    A place where creatives lift each other up. Where collaboration beats comparison.
                  </p>
                  <p>
                    Connect with fellow creatives who understand the journey.
                    Build an audience that genuinely appreciates your work.
                    Collaborate with others who inspire you.
                  </p>
                  <p>
                    No vanity metrics dictating your worth. No algorithm burying
                    your work. Just authentic connection between creators and
                    the people who love what they make.
                  </p>
                </div>
              </section>

              {/* Values Section */}
              <section id="values" className="about-section scroll-mt-24">
                <header className="mb-8">
                  <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
                    04
                  </span>
                  <h2 className="font-display text-2xl font-normal text-ink">
                    What We Stand For
                  </h2>
                </header>

                <p className="mb-8">
                  These aren't just values on a page. They're the principles that guide every feature we build.
                </p>

                <div className="space-y-8">
                  <div className="border-t border-black/[0.06] pt-6">
                    <h4 className="font-display text-lg text-ink mb-2">Authenticity First</h4>
                    <p className="!mb-0">
                      Your art is yours. We celebrate raw, real creativity without filters
                      or algorithms deciding what's worthy of being seen.
                    </p>
                  </div>

                  <div className="border-t border-black/[0.06] pt-6">
                    <h4 className="font-display text-lg text-ink mb-2">Safe Expression</h4>
                    <p className="!mb-0">
                      Create without fear. Your work and identity are protected here.
                      We built this platform to be a sanctuary, not a battlefield.
                    </p>
                  </div>

                  <div className="border-t border-black/[0.06] pt-6">
                    <h4 className="font-display text-lg text-ink mb-2">Every Medium Welcome</h4>
                    <p className="!mb-0">
                      Words, visuals, audio, video—if you create it, there's a home for it.
                      No creative left behind, no medium overlooked.
                    </p>
                  </div>

                  <div className="border-t border-black/[0.06] pt-6">
                    <h4 className="font-display text-lg text-ink mb-2">No Ads, No Noise</h4>
                    <p className="!mb-0">
                      Your feed is for creativity, not commercials. We'll never interrupt
                      your experience with ads or sell your attention to the highest bidder.
                    </p>
                  </div>
                </div>
              </section>

              {/* For You Section */}
              <section id="for-you" className="about-section scroll-mt-24">
                <header className="mb-6">
                  <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
                    05
                  </span>
                  <h2 className="font-display text-2xl font-normal text-ink">
                    Built For You
                  </h2>
                </header>

                <div>
                  <p>
                    <strong>Your art. Your rules. Your community.</strong>
                  </p>
                  <p>
                    Whether you're a musician dropping tracks, a photographer capturing moments,
                    an actor building your portfolio, a model showcasing your work, a dancer
                    sharing choreography, or any kind of creative doing your thing—PinkQuill
                    is built for you.
                  </p>
                  <p>
                    Share what you create. Find your people. Grow together.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mt-8">
                  {["Musicians", "Visual Artists", "Photographers", "Filmmakers", "Dancers", "Actors", "Models", "Designers", "Writers", "Poets", "Creators"].map((type) => (
                    <span
                      key={type}
                      className="px-3 py-1.5 rounded-full border border-black/[0.06] font-ui text-xs text-ink/60"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </section>

              {/* Join Section */}
              <section id="join" className="about-section scroll-mt-24">
                <header className="mb-6">
                  <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-2">
                    06
                  </span>
                  <h2 className="font-display text-2xl font-normal text-ink">
                    Join the Community
                  </h2>
                </header>

                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-8">
                  <Image
                    src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2670&auto=format&fit=crop"
                    alt="Join the creative community"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-primary/80 via-pink-vivid/70 to-orange-warm/60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center px-6">
                      <p className="font-display text-2xl md:text-3xl text-white mb-6">
                        Ready to share your work?
                      </p>
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white font-ui text-sm font-semibold text-purple-primary shadow-xl hover:-translate-y-0.5 transition-all"
                      >
                        Start Creating
                      </Link>
                    </div>
                  </div>
                </div>

                <div>
                  <p>
                    Thousands of creatives are already here. Your audience is waiting.
                    Your community is ready. All that's missing is you.
                  </p>
                </div>

                <div className="mt-8 space-y-2">
                  <p>
                    <span className="text-muted">Questions —</span>{" "}
                    <a href="mailto:hello@pinkquill.com" className="text-purple-primary hover:underline">
                      hello@pinkquill.com
                    </a>
                  </p>
                </div>
              </section>

            </div>

            {/* Closing */}
            <div className="mt-24 pt-16 border-t border-black/[0.06] text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
                <span className="w-8 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
                <FontAwesomeIcon icon={faFeatherPointed} className="w-5 h-5 text-purple-primary/50" />
                <span className="w-8 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
              </div>
              <p className="font-body text-muted italic mb-8">
                Made with love for creatives everywhere.
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
            <Link href="/terms" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Terms
            </Link>
            <Link href="/about" className="font-ui text-xs text-purple-primary">
              About
            </Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .about-section p {
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.85;
          color: #3d3d3d;
          margin-bottom: 1.25rem;
        }

        .about-section p:last-child {
          margin-bottom: 0;
        }

        .about-section strong {
          font-weight: 600;
          color: var(--ink);
        }

        .about-section a {
          color: var(--primary-purple);
          text-decoration: none;
          transition: color 0.2s;
        }

        .about-section a:hover {
          color: var(--vivid-pink);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
