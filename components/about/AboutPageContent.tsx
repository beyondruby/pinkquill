"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faHeart,
  faUsers,
  faLightbulb,
  faShieldHeart,
  faInfinity,
  faArrowRight,
  faStar,
  faQuoteLeft,
} from "@fortawesome/free-solid-svg-icons";

const creativeTypes = [
  { name: "Musicians", color: "from-violet-500 to-purple-600" },
  { name: "Writers", color: "from-purple-500 to-pink-500" },
  { name: "Visual Artists", color: "from-pink-500 to-rose-500" },
  { name: "Photographers", color: "from-rose-500 to-orange-500" },
  { name: "Filmmakers", color: "from-orange-500 to-amber-500" },
  { name: "Poets", color: "from-amber-500 to-yellow-500" },
  { name: "Dancers", color: "from-emerald-500 to-teal-500" },
  { name: "Actors", color: "from-teal-500 to-cyan-500" },
  { name: "Models", color: "from-cyan-500 to-blue-500" },
  { name: "Designers", color: "from-blue-500 to-indigo-500" },
  { name: "Creators", color: "from-indigo-500 to-violet-500" },
];

const values = [
  {
    icon: faHeart,
    title: "Authenticity First",
    description: "Your art is yours. We celebrate raw, real creativity without filters or algorithms deciding what's worthy.",
  },
  {
    icon: faUsers,
    title: "Community Over Competition",
    description: "We're building a space where creatives lift each other up. Collaboration beats comparison, always.",
  },
  {
    icon: faShieldHeart,
    title: "Safe Expression",
    description: "Create freely knowing your work and your identity are protected. Your voice matters here.",
  },
  {
    icon: faLightbulb,
    title: "Every Medium Welcome",
    description: "Words, visuals, audio, video - if you create it, there's a home for it here. No creative left behind.",
  },
];

const stats = [
  { number: "100%", label: "Creator-focused" },
  { number: "0", label: "Ads in your feed" },
  { number: "All", label: "Creative types welcome" },
  { number: "24/7", label: "Your content, your way" },
];

export default function AboutPageContent() {
  return (
    <div className="min-h-screen bg-[#FDFCFD] overflow-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-purple-primary/8 via-pink-vivid/5 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-orange-warm/8 via-pink-vivid/5 to-transparent blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-gradient-to-bl from-purple-primary/5 to-transparent blur-[80px]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-24 md:pt-32 md:pb-36 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-purple-primary/10 shadow-sm mb-8">
            <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary" />
            <span className="font-ui text-sm font-medium text-ink">The Creative Platform</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-ink mb-8 leading-[1.1]">
            Built by creatives,
            <br />
            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm">
              for creatives
            </span>
          </h1>

          <p className="font-body text-lg md:text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
            PinkQuill is the social platform where your creativity takes center stage.
            No algorithms deciding your worth. No ads interrupting your flow.
            Just pure creative expression and a community that actually cares.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group px-8 py-4 rounded-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm font-ui text-base font-semibold text-white shadow-xl shadow-purple-primary/25 hover:shadow-2xl hover:shadow-purple-primary/30 hover:-translate-y-0.5 transition-all flex items-center gap-3"
            >
              <span>Start Creating</span>
              <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/explore"
              className="px-8 py-4 rounded-full bg-white/80 backdrop-blur-sm border border-black/10 font-ui text-base font-medium text-ink hover:bg-white hover:border-purple-primary/20 transition-all"
            >
              Explore the Platform
            </Link>
          </div>
        </div>
      </section>

      {/* Creative Types Marquee */}
      <section className="relative z-10 py-12 overflow-hidden">
        <div className="animate-marquee flex whitespace-nowrap">
          {[...creativeTypes, ...creativeTypes].map((type, index) => (
            <span
              key={index}
              className={`mx-6 px-6 py-3 rounded-full bg-gradient-to-r ${type.color} font-ui text-sm font-semibold text-white shadow-lg`}
            >
              {type.name}
            </span>
          ))}
        </div>
      </section>

      {/* Mission Section */}
      <section className="relative z-10 py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-16 border border-white/50 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                <FontAwesomeIcon icon={faQuoteLeft} className="w-5 h-5 text-white" />
              </div>
              <span className="font-ui text-sm font-semibold uppercase tracking-wider text-purple-primary">Our Mission</span>
            </div>

            <h2 className="font-display text-3xl md:text-4xl text-ink mb-8 leading-[1.3]">
              We believe every creative deserves a platform that respects their work,
              protects their voice, and connects them with people who truly appreciate what they do.
            </h2>

            <p className="font-body text-lg text-muted leading-relaxed">
              The internet wasn't built for creatives. It was built for advertisers.
              We're changing that. PinkQuill is a space where your art isn't content to be monetized -
              it's expression to be celebrated. Whether you're sharing your first sketch or your hundredth song,
              this is where you belong.
            </p>
          </div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="relative z-10 py-24 md:py-32 px-6 bg-gradient-to-b from-transparent via-purple-primary/[0.02] to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl text-ink mb-6">
              What we stand for
            </h2>
            <p className="font-body text-lg text-muted max-w-2xl mx-auto">
              These aren't just values on a page. They're the principles that guide every feature we build.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="group bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-black/[0.04] hover:border-purple-primary/20 hover:shadow-xl hover:shadow-purple-primary/5 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FontAwesomeIcon icon={value.icon} className="w-6 h-6 text-purple-primary" />
                </div>
                <h3 className="font-display text-xl text-ink mb-3">{value.title}</h3>
                <p className="font-body text-muted leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="font-display text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-purple-primary to-pink-vivid mb-2">
                  {stat.number}
                </div>
                <div className="font-ui text-sm text-muted uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Every Creative Section */}
      <section className="relative z-10 py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 mb-8">
            <FontAwesomeIcon icon={faInfinity} className="w-4 h-4 text-purple-primary" />
            <span className="font-ui text-sm font-medium text-ink">Every Creative Welcome</span>
          </div>

          <h2 className="font-display text-4xl md:text-5xl text-ink mb-8">
            Your art. Your rules. Your community.
          </h2>

          <p className="font-body text-lg text-muted max-w-3xl mx-auto mb-12 leading-relaxed">
            Whether you're a musician dropping tracks, a poet sharing verses, a photographer capturing moments,
            an actor building your portfolio, a model showcasing your work, or any kind of creative doing your thing -
            PinkQuill is built for you. Share what you create. Find your people. Grow together.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {["Share your work", "Build your audience", "Collaborate with others", "Get discovered", "Stay inspired"].map((item, index) => (
              <span
                key={index}
                className="px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-black/[0.06] font-ui text-sm text-ink"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm rounded-[2.5rem] p-12 md:p-20 overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 text-center">
              <FontAwesomeIcon icon={faStar} className="w-8 h-8 text-white/80 mb-6" />
              <h2 className="font-display text-3xl md:text-5xl text-white mb-6">
                Ready to join the creative revolution?
              </h2>
              <p className="font-body text-lg text-white/80 max-w-xl mx-auto mb-10">
                Thousands of creatives are already here. Your audience is waiting.
                Your community is ready. All that's missing is you.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-white font-ui text-base font-semibold text-purple-primary shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all group"
              >
                <span>Create Your Account</span>
                <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="relative z-10 py-16 px-6 border-t border-black/[0.04]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-body text-muted text-sm">
            PinkQuill is made with love for creatives everywhere.
            <br className="hidden md:block" />
            Questions? Reach out at{" "}
            <a href="mailto:hello@pinkquill.co" className="text-purple-primary hover:underline">
              hello@pinkquill.co
            </a>
          </p>
        </div>
      </section>

      {/* Marquee Animation Styles */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
