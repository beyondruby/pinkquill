"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCheckCircle,
  faFeatherPointed,
  faHeart,
  faPenNib,
  faRocket,
  faShield,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

const sectionItems = [
  { id: "pulse", label: "The Pulse" },
  { id: "platform", label: "The Platform" },
  { id: "mission", label: "Our Mission" },
  { id: "vision", label: "Our Vision" },
  { id: "culture", label: "Our Culture" },
  { id: "join", label: "Join PinkQuill" },
];

const creativeTags = [
  "Musicians",
  "Writers",
  "Photographers",
  "Filmmakers",
  "Dancers",
  "Actors",
  "Models",
  "Designers",
  "Poets",
  "Illustrators",
  "Producers",
  "Creators",
];

const promiseCards = [
  {
    icon: faShield,
    title: "Creator Ownership",
    copy: "Your art remains yours. Always. PinkQuill exists to amplify your work, not claim it.",
  },
  {
    icon: faPenNib,
    title: "Expression First",
    copy: "Eleven post types give every creative medium a home, from words and visuals to sound and motion.",
  },
  {
    icon: faUsers,
    title: "Real Community",
    copy: "No algorithmic chaos. No attention games. Just people who genuinely care about what you make.",
  },
  {
    icon: faHeart,
    title: "No Ads. No Noise.",
    copy: "Your feed is for inspiration and connection, not interruptions and commercial clutter.",
  },
];

const visionCards = [
  {
    title: "A fair stage for every creator",
    copy: "We are building a platform where discovery is based on creative value, not manufactured virality.",
  },
  {
    title: "Collaboration over comparison",
    copy: "PinkQuill should feel like a studio where artists find each other, share opportunities, and build together.",
  },
  {
    title: "Creative careers with dignity",
    copy: "From first post to professional growth, we want creators to build sustainable momentum on their terms.",
  },
  {
    title: "A lasting digital home",
    copy: "Your portfolio, your voice, your journey. PinkQuill is designed to archive your evolution, not bury it.",
  },
];

export default function AboutPageContent() {
  const [activeSection, setActiveSection] = useState(sectionItems[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-25% 0px -60% 0px" }
    );

    sectionItems.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#FDFCFB] text-ink">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="pq-aurora pq-aurora-1" />
        <div className="pq-aurora pq-aurora-2" />
        <div className="pq-aurora pq-aurora-3" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.06] bg-[#FDFCFB]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 font-ui text-sm text-muted transition-colors hover:text-ink"
          >
            <FontAwesomeIcon
              icon={faArrowLeft}
              className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            />
            Back
          </Link>

          <Link href="/" className="inline-flex items-center gap-2">
            <FontAwesomeIcon icon={faFeatherPointed} className="h-4 w-4 text-purple-primary" />
            <span className="font-ui text-sm font-medium text-ink">PinkQuill</span>
          </Link>

          <Link
            href="/login"
            className="hidden rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid px-4 py-2 font-ui text-xs font-semibold text-white shadow-lg shadow-purple-primary/20 transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            Start Creating
          </Link>
        </div>
      </header>

      <section id="pulse" className="scroll-mt-28 px-6 pt-28 pb-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <p className="mb-5 font-ui text-[0.7rem] uppercase tracking-[0.24em] text-muted">
                About PinkQuill
              </p>
              <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl md:text-7xl">
                Creativity
                <span className="block bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
                  deserves
                </span>
                a real home.
              </h1>
              <p className="mt-7 max-w-xl font-body text-lg leading-relaxed text-ink/75">
                PinkQuill is a social platform built for creators who want to be seen for their voice, not for how
                well they play the algorithm. This is where your work can breathe, connect, and matter.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid px-6 py-3 font-ui text-sm font-semibold text-white shadow-xl shadow-pink-vivid/25 transition-transform hover:-translate-y-0.5"
                >
                  Begin Your Journey
                </Link>
                <a
                  href="#mission"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 px-6 py-3 font-ui text-sm font-medium text-ink transition-colors hover:border-purple-primary/30 hover:text-purple-primary"
                >
                  Read Our Mission
                </a>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl text-purple-primary">11</p>
                  <p className="mt-1 font-ui text-[0.7rem] uppercase tracking-[0.15em] text-muted">Post Types</p>
                </div>
                <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl text-pink-vivid">0</p>
                  <p className="mt-1 font-ui text-[0.7rem] uppercase tracking-[0.15em] text-muted">Ads In Feed</p>
                </div>
                <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl text-orange-warm">100%</p>
                  <p className="mt-1 font-ui text-[0.7rem] uppercase tracking-[0.15em] text-muted">Creator Owned</p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[480px]">
              <div className="pq-hero-shell absolute inset-0 overflow-hidden rounded-[2rem] border border-white/50 bg-white/70 shadow-2xl shadow-purple-primary/10">
                <Image
                  src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1600&auto=format&fit=crop"
                  alt="Creative artist working with focus"
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-ink/35 via-transparent to-purple-primary/20" />
                <div className="absolute bottom-5 left-5 rounded-2xl border border-white/30 bg-black/25 px-4 py-3 backdrop-blur">
                  <p className="font-ui text-[0.65rem] uppercase tracking-[0.16em] text-white/70">The PinkQuill Vibe</p>
                  <p className="mt-1 font-display text-xl text-white">Focused. Fearless. Connected.</p>
                </div>
              </div>

              <div className="pq-floating-card pq-floating-card-1 absolute -left-6 top-8 w-[220px] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl shadow-black/10">
                <Image
                  src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=900&auto=format&fit=crop"
                  alt="Creator sketching ideas"
                  width={320}
                  height={220}
                  className="h-32 w-full object-cover"
                />
                <div className="p-3">
                  <p className="font-ui text-[0.65rem] uppercase tracking-[0.16em] text-muted">Your Work</p>
                  <p className="mt-1 font-body text-sm text-ink/80">Protected and presented your way.</p>
                </div>
              </div>

              <div className="pq-floating-card pq-floating-card-2 absolute -bottom-5 right-0 w-[230px] rounded-2xl border border-black/5 bg-white p-4 shadow-xl shadow-black/10">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-primary/10 text-purple-primary">
                  <FontAwesomeIcon icon={faUsers} className="h-4 w-4" />
                </div>
                <p className="font-display text-xl text-ink">Community over competition</p>
                <p className="mt-2 font-body text-sm text-muted">Find people who uplift your craft and challenge you to grow.</p>
              </div>
            </div>
          </div>

          <div className="mt-16 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/65 py-4 backdrop-blur-sm">
            <div className="pq-marquee">
              {[...creativeTags, ...creativeTags].map((tag, index) => (
                <span key={`${tag}-${index}`} className="pq-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl gap-12 px-6 pb-28">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 rounded-2xl border border-black/[0.06] bg-white/75 p-5 backdrop-blur-md">
            <p className="mb-4 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-muted">On this page</p>
            <ul className="space-y-1.5">
              {sectionItems.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`group inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-sm transition-all ${
                      activeSection === id ? "text-purple-primary" : "text-muted hover:text-ink"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-all ${
                        activeSection === id
                          ? "scale-125 bg-purple-primary"
                          : "bg-black/20 group-hover:bg-black/40"
                      }`}
                    />
                    <span className="font-body">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <nav className="mb-12 overflow-x-auto pb-2 scrollbar-hide lg:hidden">
            <div className="flex w-max gap-2">
              {sectionItems.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={`rounded-full border px-4 py-2 font-ui text-xs uppercase tracking-[0.12em] transition-colors ${
                    activeSection === id
                      ? "border-purple-primary/40 bg-purple-primary/10 text-purple-primary"
                      : "border-black/10 bg-white/70 text-muted"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <article className="space-y-20">
            <section id="platform" className="scroll-mt-28">
              <div className="rounded-[2rem] border border-black/[0.06] bg-white/80 p-8 shadow-[0_20px_50px_-35px_rgba(30,30,30,0.45)] backdrop-blur-sm md:p-10">
                <p className="mb-4 font-ui text-[0.68rem] uppercase tracking-[0.2em] text-purple-primary/80">
                  The Platform
                </p>
                <h2 className="font-display text-4xl leading-tight text-ink md:text-5xl">
                  PinkQuill is social media reimagined for artists.
                </h2>
                <p className="about-copy mt-5">
                  Most platforms optimize for interruption. PinkQuill optimizes for creative momentum. We design every
                  part of the website around one question: does this help creators share meaningful work and form
                  meaningful relationships?
                </p>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {promiseCards.map((card) => (
                    <div
                      key={card.title}
                      className="group rounded-2xl border border-black/[0.06] bg-[#fffdfd] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-primary/20 hover:shadow-lg hover:shadow-purple-primary/10"
                    >
                      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-primary/15 via-pink-vivid/15 to-orange-warm/20 text-purple-primary">
                        <FontAwesomeIcon icon={card.icon} className="h-4 w-4" />
                      </div>
                      <h3 className="font-display text-2xl text-ink">{card.title}</h3>
                      <p className="mt-2 font-body text-[0.96rem] leading-relaxed text-ink/70">{card.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="mission" className="scroll-mt-28">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="relative min-h-[340px] overflow-hidden rounded-[1.8rem] border border-black/[0.06]">
                  <Image
                    src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1400&auto=format&fit=crop"
                    alt="Creative collaborators around a table"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-ink/45 via-transparent to-purple-primary/30" />
                  <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/25 bg-black/25 p-4 backdrop-blur">
                    <p className="font-ui text-[0.65rem] uppercase tracking-[0.16em] text-white/75">Mission</p>
                    <p className="mt-1 font-display text-2xl text-white">Protect every creator&apos;s voice and ownership.</p>
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-black/[0.06] bg-white/80 p-8 backdrop-blur-sm">
                  <h2 className="font-display text-4xl text-ink md:text-5xl">Our mission</h2>
                  <div className="about-copy mt-4 space-y-4">
                    <p>
                      PinkQuill exists to give creators a space where expression is respected, not exploited. Your work
                      is not disposable content. It is identity, effort, and craft.
                    </p>
                    <p>
                      We built this platform so musicians, writers, photographers, filmmakers, dancers, actors, models,
                      and multidisciplinary artists can share boldly without surrendering control.
                    </p>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {[
                      "Your creative rights stay with you.",
                      "Your growth is supported by real people, not hidden ranking rules.",
                      "Your voice can evolve in public without being reduced to vanity metrics.",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faCheckCircle} className="mt-1 h-4 w-4 text-purple-primary" />
                        <span className="font-body text-[0.95rem] text-ink/75">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section id="vision" className="scroll-mt-28">
              <div className="rounded-[2rem] border border-black/[0.06] bg-gradient-to-br from-white via-white to-purple-primary/[0.05] p-8 md:p-10">
                <p className="mb-4 font-ui text-[0.68rem] uppercase tracking-[0.2em] text-pink-vivid/90">Our Vision</p>
                <h2 className="font-display text-4xl text-ink md:text-5xl">
                  Build the internet&apos;s most trusted home for creative life.
                </h2>
                <p className="about-copy mt-5 max-w-3xl">
                  We are creating a future where creators do not have to choose between authenticity and visibility.
                  PinkQuill should be the place where discovering art feels human again.
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {visionCards.map((card, index) => (
                    <div
                      key={card.title}
                      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 p-5"
                    >
                      <span className="mb-2 inline-block font-ui text-[0.65rem] uppercase tracking-[0.16em] text-muted">
                        Vision {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-display text-2xl text-ink">{card.title}</h3>
                      <p className="mt-2 font-body text-[0.95rem] leading-relaxed text-ink/70">{card.copy}</p>
                      <div className="absolute right-4 top-4 h-10 w-10 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10" />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="culture" className="scroll-mt-28">
              <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="rounded-[1.8rem] border border-black/[0.06] bg-white/80 p-8 backdrop-blur-sm">
                  <p className="mb-4 font-ui text-[0.68rem] uppercase tracking-[0.2em] text-orange-warm">Community Culture</p>
                  <h2 className="font-display text-4xl text-ink md:text-5xl">What it feels like to be here</h2>
                  <div className="about-copy mt-5 space-y-4">
                    <p>
                      PinkQuill is designed to feel like a creative studio: calm, generous, and alive with possibility.
                      We reward depth, craft, and consistency over hype.
                    </p>
                    <p>
                      People come here to discover work that moves them, meet artists they believe in, and participate in
                      something bigger than a feed.
                    </p>
                  </div>
                  <div className="mt-6 rounded-2xl border border-purple-primary/15 bg-purple-primary/[0.06] p-4">
                    <p className="font-body text-sm italic leading-relaxed text-ink/75">
                      &quot;When creators feel safe, they take bigger risks. Bigger risks create unforgettable art.&quot;
                    </p>
                  </div>
                </div>

                <div className="grid grid-rows-2 gap-6">
                  <div className="relative overflow-hidden rounded-[1.8rem] border border-black/[0.06]">
                    <Image
                      src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1400&auto=format&fit=crop"
                      alt="Creators collaborating in a studio environment"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-ink/35 via-transparent to-pink-vivid/20" />
                  </div>
                  <div className="relative overflow-hidden rounded-[1.8rem] border border-black/[0.06]">
                    <Image
                      src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1400&auto=format&fit=crop"
                      alt="Creative team refining their project together"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-primary/40 via-transparent to-orange-warm/30" />
                    <div className="absolute bottom-4 left-4 rounded-full border border-white/35 bg-white/20 px-4 py-2 backdrop-blur">
                      <span className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-white">
                        Collaboration Lives Here
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section id="join" className="scroll-mt-28">
              <div className="relative overflow-hidden rounded-[2rem] border border-black/[0.06]">
                <Image
                  src="https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1800&auto=format&fit=crop"
                  alt="Open notebook and camera representing creative storytelling"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-purple-primary/65 to-pink-vivid/60" />

                <div className="relative p-8 md:p-12">
                  <p className="mb-4 font-ui text-[0.68rem] uppercase tracking-[0.2em] text-white/75">Join PinkQuill</p>
                  <h2 className="max-w-2xl font-display text-4xl text-white md:text-5xl">
                    Share your craft where people truly care.
                  </h2>
                  <p className="mt-4 max-w-2xl font-body text-lg leading-relaxed text-white/85">
                    If you are ready for a platform that values your creative journey, your originality, and your future,
                    you belong here.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-ui text-sm font-semibold text-purple-primary transition-transform hover:-translate-y-0.5"
                    >
                      Start on PinkQuill
                    </Link>
                    <a
                      href="mailto:hello@pinkquill.com"
                      className="inline-flex items-center gap-2 rounded-full border border-white/35 px-6 py-3 font-ui text-sm font-medium text-white transition-colors hover:bg-white/15"
                    >
                      Talk to Us
                    </a>
                  </div>

                  <div className="pq-glow mt-9 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2">
                    <FontAwesomeIcon icon={faRocket} className="h-3.5 w-3.5 text-white" />
                    <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/90">
                      Built for creators. Built to last.
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </article>

          <footer className="mt-16 border-t border-black/[0.06] pt-7 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-ui text-xs text-muted/70">© {new Date().getFullYear()} PinkQuill</p>
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="font-ui text-xs text-muted/70 transition-colors hover:text-purple-primary">
                  Privacy
                </Link>
                <Link href="/terms" className="font-ui text-xs text-muted/70 transition-colors hover:text-purple-primary">
                  Terms
                </Link>
                <Link href="/about" className="font-ui text-xs text-purple-primary">
                  About
                </Link>
              </div>
            </div>
          </footer>
        </main>
      </div>

      <style jsx global>{`
        .about-copy p {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.8;
          color: rgba(30, 30, 30, 0.78);
          margin: 0;
        }

        .pq-aurora {
          position: absolute;
          border-radius: 999px;
          filter: blur(92px);
          opacity: 0.22;
          animation: pqDrift 14s ease-in-out infinite alternate;
        }

        .pq-aurora-1 {
          top: -120px;
          left: -160px;
          width: 560px;
          height: 560px;
          background: #8e44ad;
        }

        .pq-aurora-2 {
          right: -160px;
          top: 260px;
          width: 440px;
          height: 440px;
          animation-delay: 3s;
          background: #ff007f;
        }

        .pq-aurora-3 {
          left: 35%;
          bottom: -200px;
          width: 500px;
          height: 500px;
          animation-delay: 6s;
          background: #ff9f43;
          opacity: 0.16;
        }

        .pq-hero-shell {
          animation: pqLift 8s ease-in-out infinite;
        }

        .pq-floating-card {
          animation: pqFloat 8s ease-in-out infinite;
        }

        .pq-floating-card-2 {
          animation-delay: 1.4s;
        }

        .pq-marquee {
          display: flex;
          width: max-content;
          animation: pqMarquee 36s linear infinite;
        }

        .pq-tag {
          margin-right: 0.6rem;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 999px;
          padding: 0.45rem 0.8rem;
          font-family: var(--font-ui);
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(30, 30, 30, 0.72);
          background: rgba(255, 255, 255, 0.75);
          white-space: nowrap;
        }

        .pq-glow {
          animation: pqGlow 2.8s ease-in-out infinite;
        }

        @keyframes pqDrift {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(22px, -20px, 0) scale(1.07);
          }
        }

        @keyframes pqFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes pqLift {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-6px) rotate(0.3deg);
          }
        }

        @keyframes pqMarquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes pqGlow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.25);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .pq-aurora,
          .pq-hero-shell,
          .pq-floating-card,
          .pq-marquee,
          .pq-glow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
