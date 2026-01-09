"use client";

import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

export default function AboutPageContent() {
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-ui text-[0.7rem] tracking-[0.2em] uppercase text-muted mb-6">
            About
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-normal mb-8 leading-[1.1]">
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              A home for
            </span>
            <br />
            <span className="text-ink">those who create</span>
          </h1>
          <p className="font-body text-xl text-ink/60 leading-relaxed max-w-2xl mx-auto">
            PinkQuill is the social platform built by creatives, for creatives.
            A space where your work takes center stage and your voice truly matters.
          </p>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="flex items-center justify-center gap-3 pb-20">
        <span className="w-12 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
        <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary/40" />
        <span className="w-12 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
      </div>

      {/* Full-width Image */}
      <section className="relative w-full h-[50vh] md:h-[60vh] mb-24">
        <Image
          src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=2671&auto=format&fit=crop"
          alt="Artist at work"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FDFCFB] via-transparent to-transparent" />
      </section>

      {/* Mission Section */}
      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-purple-primary/60 mb-4">
            Our Mission
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-ink mb-8 leading-[1.3]">
            We believe every creative deserves a platform that respects their work,
            protects their voice, and connects them with people who truly appreciate
            what they do.
          </h2>
          <div className="space-y-6">
            <p className="font-body text-lg text-ink/70 leading-relaxed">
              The internet wasn't built for creatives. It was built for advertisers.
              Algorithms decide what gets seen. Engagement metrics define worth.
              Your art becomes content to be monetized, not expression to be celebrated.
            </p>
            <p className="font-body text-lg text-ink/70 leading-relaxed">
              We're building something different. PinkQuill is a sanctuary where
              musicians, visual artists, photographers, filmmakers, dancers, actors,
              models, designers—anyone who creates—can share their work without
              compromise. Where community means support, not competition.
            </p>
          </div>
        </div>
      </section>

      {/* Two Column Image + Text */}
      <section className="px-6 pb-32">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=2680&auto=format&fit=crop"
              alt="Creative expression"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-purple-primary/60 mb-4">
              Your Work, Your Rules
            </p>
            <h3 className="font-display text-2xl md:text-3xl text-ink mb-6 leading-[1.3]">
              You own everything you create. We're just here to help you share it.
            </h3>
            <div className="space-y-4">
              <p className="font-body text-ink/70 leading-relaxed">
                Your art stays yours. No hidden clauses, no rights grabs.
                When you post on PinkQuill, you retain full ownership
                of your work—always.
              </p>
              <p className="font-body text-ink/70 leading-relaxed">
                Share poems, music, photography, films, choreography, portfolios,
                or whatever form your creativity takes. Eleven post types designed
                for different expressions. Every medium has a home here.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="px-6 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative py-16 px-8 md:px-16">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-b from-transparent to-purple-primary/30" />
            <blockquote className="font-display text-2xl md:text-3xl lg:text-4xl text-ink italic leading-[1.4] mb-8">
              "Create freely knowing your work and your identity are protected.
              Your voice matters here."
            </blockquote>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-t from-transparent to-purple-primary/30" />
          </div>
        </div>
      </section>

      {/* Reverse Two Column */}
      <section className="px-6 pb-32">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="order-2 md:order-1">
            <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-purple-primary/60 mb-4">
              Community Over Competition
            </p>
            <h3 className="font-display text-2xl md:text-3xl text-ink mb-6 leading-[1.3]">
              A place where creatives lift each other up. Where collaboration beats comparison.
            </h3>
            <div className="space-y-4">
              <p className="font-body text-ink/70 leading-relaxed">
                Connect with fellow creatives who understand the journey.
                Build an audience that genuinely appreciates your work.
                Collaborate with others who inspire you.
              </p>
              <p className="font-body text-ink/70 leading-relaxed">
                No vanity metrics dictating your worth. No algorithm burying
                your work. Just authentic connection between creators and
                the people who love what they make.
              </p>
            </div>
          </div>
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden order-1 md:order-2">
            <Image
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2670&auto=format&fit=crop"
              alt="Creative collaboration"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="px-6 pb-32">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-purple-primary/60 mb-4">
              What We Stand For
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-ink">
              Principles that guide everything we build
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <div className="border-t border-black/[0.06] pt-8">
              <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-3">01</span>
              <h4 className="font-display text-xl text-ink mb-3">Authenticity First</h4>
              <p className="font-body text-ink/70 leading-relaxed">
                Your art is yours. We celebrate raw, real creativity without filters
                or algorithms deciding what's worthy of being seen.
              </p>
            </div>

            <div className="border-t border-black/[0.06] pt-8">
              <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-3">02</span>
              <h4 className="font-display text-xl text-ink mb-3">Safe Expression</h4>
              <p className="font-body text-ink/70 leading-relaxed">
                Create without fear. Your work and identity are protected here.
                We built this platform to be a sanctuary, not a battlefield.
              </p>
            </div>

            <div className="border-t border-black/[0.06] pt-8">
              <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-3">03</span>
              <h4 className="font-display text-xl text-ink mb-3">Every Medium Welcome</h4>
              <p className="font-body text-ink/70 leading-relaxed">
                Words, visuals, audio, video—if you create it, there's a home for it.
                No creative left behind, no medium overlooked.
              </p>
            </div>

            <div className="border-t border-black/[0.06] pt-8">
              <span className="font-ui text-[0.65rem] tracking-[0.2em] text-purple-primary/60 block mb-3">04</span>
              <h4 className="font-display text-xl text-ink mb-3">No Ads, No Noise</h4>
              <p className="font-body text-ink/70 leading-relaxed">
                Your feed is for creativity, not commercials. We'll never interrupt
                your experience with ads or sell your attention to the highest bidder.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width Image 2 */}
      <section className="relative w-full h-[40vh] md:h-[50vh] mb-24">
        <Image
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2574&auto=format&fit=crop"
          alt="Creative community"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FDFCFB] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCFB] via-transparent to-transparent" />
      </section>

      {/* For Everyone Section */}
      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-ui text-[0.65rem] tracking-[0.2em] uppercase text-purple-primary/60 mb-4">
            Built For You
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-ink mb-8 leading-[1.3]">
            Your art. Your rules. Your community.
          </h2>
          <p className="font-body text-lg text-ink/70 leading-relaxed mb-12">
            Whether you're a musician dropping tracks, a photographer capturing moments,
            an actor building your portfolio, a model showcasing your work, a dancer
            sharing choreography, or any kind of creative doing your thing—PinkQuill
            is built for you. Share what you create. Find your people. Grow together.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {["Musicians", "Visual Artists", "Photographers", "Filmmakers", "Dancers", "Actors", "Models", "Designers", "Writers", "Poets", "Creators"].map((type) => (
              <span
                key={type}
                className="px-4 py-2 rounded-full border border-black/[0.06] font-ui text-sm text-ink/70"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-32">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2670&auto=format&fit=crop"
              alt="Join the creative community"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-primary/90 via-pink-vivid/80 to-orange-warm/70" />
            <div className="relative z-10 p-12 md:p-20 text-center">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-white mb-6 leading-[1.2]">
                Ready to share your work with the world?
              </h2>
              <p className="font-body text-lg text-white/80 max-w-xl mx-auto mb-10">
                Join a community of creatives who are already here.
                Your audience is waiting. All that's missing is you.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-white font-ui text-base font-semibold text-purple-primary shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all"
              >
                Start Creating
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="w-8 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
            <FontAwesomeIcon icon={faFeatherPointed} className="w-5 h-5 text-purple-primary/50" />
            <span className="w-8 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
          </div>
          <p className="font-body text-muted italic mb-4">
            Made with love for creatives everywhere.
          </p>
          <p className="font-body text-sm text-muted/60">
            Questions? Reach out at{" "}
            <a href="mailto:hello@pinkquill.app" className="text-purple-primary hover:underline">
              hello@pinkquill.app
            </a>
          </p>
        </div>
      </section>

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
    </div>
  );
}
