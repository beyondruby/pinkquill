"use client";

import Link from "next/link";

export default function AboutPageContent() {
  return (
    <div className="max-w-[680px] mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl text-ink mb-4">About PinkQuill</h1>
        <p className="font-body text-lg text-muted">
          A creative social platform for artists, poets, writers, and creators.
        </p>
      </div>

      <div className="prose prose-ink max-w-none">
        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">Our Mission</h2>
          <p className="font-body text-ink/80 leading-relaxed">
            PinkQuill is a space where creativity flourishes. We believe in empowering
            artists, writers, and creators to share their authentic voice with the world.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-2xl text-ink mb-4">What We Offer</h2>
          <ul className="font-body text-ink/80 space-y-2">
            <li>A beautiful platform for sharing poems, essays, stories, and more</li>
            <li>Support for multiple creative formats including visual and audio content</li>
            <li>A respectful community focused on creativity and expression</li>
            <li>Tools for collaboration with other creators</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Join Us</h2>
          <p className="font-body text-ink/80 leading-relaxed mb-6">
            Whether you're a seasoned writer or just starting your creative journey,
            PinkQuill welcomes you.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </section>
      </div>
    </div>
  );
}
