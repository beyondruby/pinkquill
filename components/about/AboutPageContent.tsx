"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

const navItems = [
  { id: "manifesto", label: "Manifesto" },
  { id: "studio", label: "The Studio" },
  { id: "mission", label: "Mission" },
  { id: "vision", label: "Vision" },
  { id: "community", label: "Community" },
  { id: "join", label: "Join" },
];

const studioCards = [
  {
    icon: faShield,
    title: "Your work stays yours",
    copy: "Everything you publish belongs to you. PinkQuill is a home for your art, never a rights grab.",
  },
  {
    icon: faPenNib,
    title: "Every medium, one home",
    copy: "Poetry, photography, film, music, essays, letters — 11 post types shaped around how creators actually work.",
  },
  {
    icon: faUsers,
    title: "Found by the right people",
    copy: "Your audience grows through genuine taste and connection, not algorithmic noise.",
  },
  {
    icon: faHeart,
    title: "Art first, always",
    copy: "No ads, no sponsored posts, no distractions. Just your work and the people who love it.",
  },
];

const visionPoints = [
  "Let every creator be discovered for who they truly are.",
  "Give artists the tools to grow without burning out.",
  "Make publishing feel as intentional as the work itself.",
  "Build a world where collaboration outshines comparison.",
];

export default function AboutPageContent() {
  const [activeSection, setActiveSection] = useState(navItems[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-35% 0px -50% 0px" }
    );

    navItems.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas text-ink">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="ab-bg-orb ab-bg-orb-1" />
        <div className="ab-bg-orb ab-bg-orb-2" />
        <div className="ab-bg-orb ab-bg-orb-3" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border-light bg-canvas/82 backdrop-blur-xl">
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
            <span className="font-ui text-sm font-semibold text-ink">PinkQuill</span>
          </Link>

          <Link
            href="/login"
            className="hidden rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid px-4 py-2 font-ui text-xs font-semibold text-white shadow-md shadow-pink-vivid/20 transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            Start Creating
          </Link>
        </div>
      </header>

      <main className="pt-20">
        <section className="px-6 pt-10 pb-16 md:pt-14">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
            <div>
              <p className="mb-5 font-ui text-[0.7rem] uppercase tracking-[0.23em] text-muted">About PinkQuill</p>
              <h1 className="font-display text-[2.85rem] leading-[0.98] text-ink sm:text-[3.8rem] md:text-[4.8rem]">
                Where creators
                <span className="mt-2 block bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
                  feel at home.
                </span>
              </h1>
              <p className="mt-7 max-w-xl font-body text-lg leading-relaxed text-ink/75">
                PinkQuill is a space built with love for artists, poets, writers, musicians, and makers.
                Publish with care, connect with people who truly see your work, and grow at your own pace.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid px-6 py-3 font-ui text-sm font-semibold text-white shadow-xl shadow-purple-primary/20 transition-transform hover:-translate-y-0.5"
                >
                  Begin on PinkQuill
                </Link>
                <a
                  href="#manifesto"
                  className="inline-flex items-center gap-2 rounded-full border border-border-light bg-surface/75 px-6 py-3 font-ui text-sm font-medium text-ink transition-colors hover:border-accent/30 hover:text-accent"
                >
                  Read the Manifesto
                </a>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border-light bg-surface/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl text-purple-primary">11</p>
                  <p className="mt-1 font-ui text-[0.68rem] uppercase tracking-[0.15em] text-muted">Post Types</p>
                </div>
                <div className="rounded-2xl border border-border-light bg-surface/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl text-pink-vivid">0</p>
                  <p className="mt-1 font-ui text-[0.68rem] uppercase tracking-[0.15em] text-muted">Ads in Feed</p>
                </div>
                <div className="rounded-2xl border border-border-light bg-surface/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl text-orange-warm">100%</p>
                  <p className="mt-1 font-ui text-[0.68rem] uppercase tracking-[0.15em] text-muted">Creator Owned</p>
                </div>
              </div>
            </div>

            <div className="ab-hero-illustration relative min-h-[510px]">
              <div className="relative h-full overflow-hidden rounded-[2.2rem] border border-surface/50 bg-surface/70 shadow-[0_30px_70px_-40px_rgba(30,30,30,0.45)]">
                <Image
                  src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1800&auto=format&fit=crop"
                  alt="Creative person working at a desk"
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-ink/45 via-transparent to-purple-primary/25" />

                <div className="absolute top-4 left-4 rounded-full border border-surface/35 bg-surface/18 px-3 py-1.5 backdrop-blur">
                  <span className="font-ui text-[0.62rem] uppercase tracking-[0.16em] text-white/92">
                    Warm. Honest. Creative.
                  </span>
                </div>

                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-surface/30 bg-black/20 p-4 backdrop-blur-sm">
                  <p className="font-display text-2xl text-white sm:text-3xl">Make art that matters to you.</p>
                </div>
              </div>

              <div className="ab-note-card ab-note-card-1 absolute -left-7 top-7 w-[230px] rounded-2xl border border-border-light bg-surface p-4 shadow-xl shadow-black/10">
                <p className="font-ui text-[0.62rem] uppercase tracking-[0.18em] text-muted">Edition 01</p>
                <p className="mt-2 font-body text-sm leading-relaxed text-ink/80">
                  Calm enough to think. Alive enough to feel. Built with creators in mind.
                </p>
              </div>

              <div className="ab-note-card ab-note-card-2 absolute -right-6 bottom-8 w-[210px] overflow-hidden rounded-2xl border border-border-light bg-surface shadow-xl shadow-black/10">
                <Image
                  src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=900&auto=format&fit=crop"
                  alt="Designer sketching ideas"
                  width={280}
                  height={180}
                  className="h-28 w-full object-cover"
                />
                <div className="p-3.5">
                  <p className="font-ui text-[0.6rem] uppercase tracking-[0.17em] text-muted">Creative Spirit</p>
                  <p className="mt-1 font-body text-sm text-ink/78">Every detail shaped around how artists think and create.</p>
                </div>
              </div>

              <svg
                viewBox="0 0 420 420"
                className="ab-line-art pointer-events-none absolute -right-14 -bottom-14 h-60 w-60 text-purple-primary/55"
                aria-hidden
              >
                <defs>
                  <linearGradient id="ab-line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8e44ad" />
                    <stop offset="55%" stopColor="#ff007f" />
                    <stop offset="100%" stopColor="#ff9f43" />
                  </linearGradient>
                </defs>
                <path
                  d="M73 275c31-74 103-129 170-127 58 2 82 49 69 89-21 66-107 95-157 68-47-24-45-89 6-106 42-14 85 14 90 56"
                  fill="none"
                  stroke="url(#ab-line-gradient)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="630"
                  strokeDashoffset="630"
                  className="ab-line-path"
                />
              </svg>
            </div>
          </div>
        </section>

        <section className="sticky top-16 z-30 border-y border-border-light bg-canvas/90 px-6 py-3 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl overflow-x-auto scrollbar-hide">
            <nav className="flex w-max items-center gap-2">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`rounded-full border px-4 py-2 font-ui text-[0.67rem] uppercase tracking-[0.14em] transition-all ${
                    activeSection === item.id
                      ? "border-purple-primary/35 bg-purple-primary/10 text-purple-primary"
                      : "border-border-light bg-surface/75 text-muted hover:border-border-strong hover:text-ink"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <section id="manifesto" className="scroll-mt-36 px-6 py-16 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="rounded-[2rem] border border-border-light bg-surface/80 p-8 md:p-10">
              <p className="mb-5 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-purple-primary/75">Manifesto</p>
              <h2 className="font-display text-4xl leading-tight text-ink md:text-5xl">
                Creativity deserves more than a scroll.
              </h2>
              <div className="mt-6 space-y-4 font-body text-[1.03rem] leading-[1.9] text-ink/78">
                <p className="ab-dropcap">
                  We started PinkQuill because we were tired of watching beautiful work disappear into feeds that
                  don&apos;t care. Artists deserve a space that honors the time, heart, and soul they pour into what they make.
                </p>
                <p>
                  This isn&apos;t another place to perform for an algorithm. It&apos;s a quiet corner of the internet where your
                  poems, paintings, films, and stories can breathe — where creating feels personal again.
                </p>
                <p>
                  PinkQuill is for the writer who shares at midnight, the painter who needs a portfolio that feels like them,
                  and every creative who wants to be found by people who truly understand their work.
                </p>
              </div>
            </article>

            <div className="grid gap-8">
              <figure className="relative min-h-[250px] overflow-hidden rounded-[1.8rem] border border-border-light">
                <Image
                  src="https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1600&auto=format&fit=crop"
                  alt="Notebook and camera in editorial creative setup"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
                <figcaption className="absolute bottom-4 left-4 right-4 font-ui text-[0.62rem] uppercase tracking-[0.16em] text-white/80">
                  A home for every creative voice
                </figcaption>
              </figure>
              <div className="rounded-[1.8rem] border border-border-light bg-gradient-to-br from-surface to-pink-vivid/[0.06] p-6">
                <p className="font-display text-[1.75rem] leading-snug text-ink">
                  &quot;What you create is a piece of who you are. It deserves to be treated that way.&quot;
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="studio" className="scroll-mt-36 px-6 py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="relative min-h-[480px] overflow-hidden rounded-[2rem] border border-border-light">
                <Image
                  src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1800&auto=format&fit=crop"
                  alt="Creative team planning work together"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/45 via-transparent to-ink/45" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-surface/30 bg-surface/16 p-4 backdrop-blur-sm">
                  <p className="font-ui text-[0.62rem] uppercase tracking-[0.16em] text-white/82">The PinkQuill Studio</p>
                  <p className="mt-1 font-display text-2xl text-white">Built to nurture your voice, not drain it.</p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-border-light bg-surface/85 p-8 md:p-10">
                <p className="mb-4 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-pink-vivid/80">The Studio</p>
                <h2 className="font-display text-4xl leading-tight text-ink md:text-5xl">Thoughtfully crafted for the creative mind.</h2>
                <p className="mt-5 font-body text-base leading-relaxed text-ink/74">
                  Every corner of PinkQuill is designed to feel gentle and inviting — a space where you can
                  focus on what matters: your art, your words, and the people who resonate with them.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {studioCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-2xl border border-border-light bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-lg hover:shadow-purple-primary/10"
                    >
                      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-primary/16 via-pink-vivid/16 to-orange-warm/20 text-purple-primary">
                        <FontAwesomeIcon icon={card.icon} className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="font-display text-[1.26rem] leading-tight text-ink">{card.title}</h3>
                      <p className="mt-1.5 font-body text-[0.93rem] leading-relaxed text-ink/72">{card.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="mission" className="scroll-mt-36 px-6 py-16 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <article className="rounded-[2rem] border border-border-light bg-surface/82 p-8 md:p-10">
              <p className="mb-4 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-orange-warm">Mission</p>
              <h2 className="font-display text-4xl text-ink md:text-5xl">Champion the people who create.</h2>
              <div className="mt-5 space-y-4 font-body text-base leading-relaxed text-ink/75">
                <p>
                  We believe creators should feel safe, seen, and supported. PinkQuill is built around a simple
                  promise: your work, your voice, your terms.
                </p>
                <p>
                  Whether you&apos;re sharing your first poem or curating years of visual work, this is a place that
                  honors the courage it takes to put yourself out there.
                </p>
              </div>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Your creative rights are yours — always, unconditionally.",
                  "Growth here comes from genuine connection, not tricks.",
                  "Your work has space to evolve, breathe, and find its people.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faCheckCircle} className="mt-1 h-4 w-4 text-purple-primary" />
                    <span className="font-body text-sm leading-relaxed text-ink/74">{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <div className="relative min-h-[450px] overflow-hidden rounded-[2rem] border border-border-light">
              <Image
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1800&auto=format&fit=crop"
                alt="Diverse creators discussing ideas together"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-ink/55 via-transparent to-pink-vivid/25" />
              <div className="absolute left-5 bottom-5 rounded-full border border-surface/30 bg-surface/12 px-4 py-2 backdrop-blur-sm">
                <span className="font-ui text-[0.62rem] uppercase tracking-[0.16em] text-white/90">
                  Together, not against each other
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="vision" className="scroll-mt-36 px-6 py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-border-light bg-gradient-to-br from-surface via-surface to-purple-primary/[0.06] p-8 md:p-10">
            <p className="mb-4 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-purple-primary/80">Vision</p>
            <h2 className="max-w-3xl font-display text-4xl leading-tight text-ink md:text-5xl">
              A creative internet that feels like it was made for you.
            </h2>
            <p className="mt-5 max-w-3xl font-body text-base leading-relaxed text-ink/74">
              We dream of a world where being authentic and being discovered aren&apos;t at odds. Where sharing your
              work feels like an act of joy, not a performance. That&apos;s the internet PinkQuill is building.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {visionPoints.map((point, index) => (
                <div key={point} className="rounded-2xl border border-border-light bg-surface/85 p-5">
                  <p className="font-ui text-[0.62rem] uppercase tracking-[0.16em] text-muted">
                    Vision {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 font-display text-2xl leading-snug text-ink">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="community" className="scroll-mt-36 px-6 py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
              <div className="grid gap-6">
                <div className="relative min-h-[240px] overflow-hidden rounded-[1.7rem] border border-border-light">
                  <Image
                    src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1600&auto=format&fit=crop"
                    alt="Creative team collaborating in a modern studio"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
                </div>
                <div className="relative min-h-[240px] overflow-hidden rounded-[1.7rem] border border-border-light">
                  <Image
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1600&auto=format&fit=crop"
                    alt="Artists reviewing their portfolio work"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-primary/40 via-transparent to-transparent" />
                </div>
              </div>

              <article className="rounded-[2rem] border border-border-light bg-surface/82 p-8 md:p-10">
                <p className="mb-4 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-pink-vivid/85">Community</p>
                <h2 className="font-display text-4xl leading-tight text-ink md:text-5xl">People who get it.</h2>
                <div className="mt-5 space-y-4 font-body text-base leading-relaxed text-ink/75">
                  <p>
                    The best part of creating isn&apos;t the likes — it&apos;s finding someone who truly understands what
                    you made. PinkQuill is built around that feeling.
                  </p>
                  <p>
                    Here, you&apos;ll find collaborators who share your vision, readers who sit with your words, and a
                    community that celebrates the process as much as the finished piece.
                  </p>
                  <p>
                    No posturing. No clout chasing. Just real people making real things together.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="join" className="scroll-mt-36 px-6 pt-16 pb-20 md:pt-20 md:pb-24">
          <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-border-light">
            <div className="ab-cta-gradient relative px-8 py-12 md:px-12 md:py-16">
              <div className="ab-cta-orb ab-cta-orb-1" />
              <div className="ab-cta-orb ab-cta-orb-2" />

              <div className="relative max-w-3xl">
                <p className="mb-4 font-ui text-[0.65rem] uppercase tracking-[0.2em] text-white/78">Join PinkQuill</p>
                <h2 className="font-display text-4xl leading-tight text-white md:text-5xl">
                  Your creative home is waiting.
                </h2>
                <p className="mt-5 font-body text-lg leading-relaxed text-white/85">
                  Bring your poems, your paintings, your music, your stories. Bring whatever makes you, you.
                  We&apos;ll take care of the rest.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 font-ui text-sm font-semibold text-purple-primary transition-transform hover:-translate-y-0.5"
                  >
                    Start on PinkQuill
                  </Link>
                  <a
                    href="mailto:hello@pinkquill.com"
                    className="inline-flex items-center gap-2 rounded-full border border-surface/35 px-6 py-3 font-ui text-sm font-medium text-white transition-colors hover:bg-surface/15"
                  >
                    Talk with us
                  </a>
                </div>

                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-surface/30 bg-surface/12 px-4 py-2 backdrop-blur">
                  <FontAwesomeIcon icon={faRocket} className="h-3.5 w-3.5 text-white" />
                  <span className="font-ui text-xs uppercase tracking-[0.14em] text-white/90">
                    Made with love, for people who make things with love.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border-light px-6 py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="font-ui text-xs text-muted/70">© {new Date().getFullYear()} PinkQuill</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="font-ui text-xs text-muted/70 transition-colors hover:text-accent">
                Privacy
              </Link>
              <Link href="/terms" className="font-ui text-xs text-muted/70 transition-colors hover:text-accent">
                Terms
              </Link>
              <Link href="/about" className="font-ui text-xs text-purple-primary">
                About
              </Link>
            </div>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        .ab-bg-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(90px);
          opacity: 0.2;
          animation: abDrift 16s ease-in-out infinite alternate;
        }

        .ab-bg-orb-1 {
          width: 570px;
          height: 570px;
          top: -180px;
          left: -220px;
          background: #8e44ad;
        }

        .ab-bg-orb-2 {
          width: 450px;
          height: 450px;
          top: 360px;
          right: -180px;
          background: #ff007f;
          animation-delay: 4s;
        }

        .ab-bg-orb-3 {
          width: 400px;
          height: 400px;
          bottom: -180px;
          left: 36%;
          background: #ff9f43;
          opacity: 0.15;
          animation-delay: 8s;
        }

        .ab-note-card {
          animation: abFloat 7.5s ease-in-out infinite;
        }

        .ab-note-card-2 {
          animation-delay: 1.2s;
        }

        .ab-line-path {
          animation: abDraw 2.2s ease-out 0.4s both;
        }

        .ab-dropcap::first-letter {
          float: left;
          margin-right: 0.45rem;
          margin-top: 0.18rem;
          font-family: var(--font-display);
          font-size: 3rem;
          line-height: 0.8;
          color: #8e44ad;
        }

        .ab-cta-gradient {
          background: linear-gradient(130deg, #8e44ad 0%, #ff007f 48%, #ff9f43 100%);
          background-size: 160% 160%;
          animation: abGradient 9s ease infinite;
        }

        .ab-cta-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(55px);
          opacity: 0.34;
        }

        .ab-cta-orb-1 {
          width: 190px;
          height: 190px;
          top: -30px;
          right: 20%;
          background: rgba(255, 255, 255, 0.55);
        }

        .ab-cta-orb-2 {
          width: 150px;
          height: 150px;
          bottom: -35px;
          left: 16%;
          background: rgba(255, 255, 255, 0.42);
        }

        @keyframes abDrift {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(26px, -22px, 0) scale(1.08);
          }
        }

        @keyframes abFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes abDraw {
          from {
            stroke-dashoffset: 630;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes abGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @media (max-width: 1023px) {
          .ab-note-card-1,
          .ab-note-card-2 {
            display: none;
          }

          .ab-line-art {
            width: 10.5rem;
            height: 10.5rem;
            right: -2.7rem;
            bottom: -2.7rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ab-bg-orb,
          .ab-note-card,
          .ab-line-path,
          .ab-cta-gradient {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
