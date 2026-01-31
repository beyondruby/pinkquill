"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faRocket,
  faUser,
  faPenNib,
  faUsers,
  faEnvelope,
  faHeart,
  faShield,
  faGear,
  faChartLine,
  faSearch,
  faChevronRight,
  faQuestionCircle,
  faBook,
  faLightbulb
} from "@fortawesome/free-solid-svg-icons";

const helpCategories = [
  {
    href: "/help/getting-started",
    label: "Getting Started",
    icon: faRocket,
    description: "New to PinkQuill? Learn the basics of creating your account, setting up your profile, and navigating the platform.",
    color: "from-purple-500 to-purple-600"
  },
  {
    href: "/help/account",
    label: "Account & Profile",
    icon: faUser,
    description: "Manage your profile, update your bio, add social links, change your password, and customize your presence.",
    color: "from-blue-500 to-blue-600"
  },
  {
    href: "/help/posting",
    label: "Creating & Sharing",
    icon: faPenNib,
    description: "Learn how to create posts, takes, and share your creative work. Explore all 11 post types and media options.",
    color: "from-pink-500 to-pink-600"
  },
  {
    href: "/help/communities",
    label: "Communities",
    icon: faUsers,
    description: "Discover, join, and create communities. Learn about moderation, rules, and building your creative space.",
    color: "from-green-500 to-green-600"
  },
  {
    href: "/help/messaging",
    label: "Messaging",
    icon: faEnvelope,
    description: "Send direct messages, manage conversations, and connect privately with other creators on PinkQuill.",
    color: "from-orange-500 to-orange-600"
  },
  {
    href: "/help/interactions",
    label: "Interactions",
    icon: faHeart,
    description: "Understand follows, reactions, comments, relays, and saves. Engage meaningfully with the community.",
    color: "from-red-500 to-red-600"
  },
  {
    href: "/help/privacy-safety",
    label: "Privacy & Safety",
    icon: faShield,
    description: "Stay safe on PinkQuill. Learn how to block users, report content, and manage your privacy settings.",
    color: "from-slate-600 to-slate-700"
  },
  {
    href: "/help/settings",
    label: "Settings",
    icon: faGear,
    description: "Configure your account settings, notifications, privacy preferences, and personalize your experience.",
    color: "from-gray-500 to-gray-600"
  },
  {
    href: "/help/insights",
    label: "Insights & Analytics",
    icon: faChartLine,
    description: "Track your reach, engagement, and growth. Understand your audience and optimize your content.",
    color: "from-indigo-500 to-indigo-600"
  },
];

const popularTopics = [
  { label: "How do I create my first post?", href: "/help/posting#creating-a-post" },
  { label: "What are the different post types?", href: "/help/posting#post-types" },
  { label: "How do I block someone?", href: "/help/privacy-safety#blocking" },
  { label: "How do I join a community?", href: "/help/communities#joining" },
  { label: "How do reactions work?", href: "/help/interactions#reactions" },
  { label: "How do I change my password?", href: "/help/settings#password" },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="pb-16">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-purple-primary/5 to-transparent pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-black/5 shadow-sm mb-6">
            <FontAwesomeIcon icon={faQuestionCircle} className="w-4 h-4 text-purple-primary" />
            <span className="font-ui text-sm text-muted">Help Center</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-normal mb-4 leading-tight">
            How can we{" "}
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              help you?
            </span>
          </h1>

          <p className="font-body text-lg text-muted/80 mb-8 max-w-xl mx-auto">
            Find answers, learn features, and get the most out of your PinkQuill experience.
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50"
            />
            <input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-black/10 shadow-sm font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="flex items-center justify-center gap-3 pb-12">
        <span className="w-12 h-px bg-gradient-to-r from-transparent to-purple-primary/30" />
        <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary/40" />
        <span className="w-12 h-px bg-gradient-to-l from-transparent to-purple-primary/30" />
      </div>

      {/* Categories Grid */}
      <section className="px-6 max-w-5xl mx-auto mb-16">
        <h2 className="font-display text-2xl text-ink mb-8 text-center">Browse by topic</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {helpCategories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="group relative bg-white rounded-2xl border border-black/5 p-6 hover:shadow-lg hover:shadow-black/5 hover:border-purple-primary/20 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <FontAwesomeIcon icon={cat.icon} className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-ui text-lg font-semibold text-ink mb-2 group-hover:text-purple-primary transition-colors">
                {cat.label}
              </h3>
              <p className="font-body text-sm text-muted leading-relaxed">
                {cat.description}
              </p>
              <FontAwesomeIcon
                icon={faChevronRight}
                className="absolute top-6 right-6 w-4 h-4 text-muted/30 group-hover:text-purple-primary group-hover:translate-x-1 transition-all"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Popular Topics */}
      <section className="px-6 max-w-3xl mx-auto mb-16">
        <div className="bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 rounded-2xl border border-purple-primary/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <FontAwesomeIcon icon={faLightbulb} className="w-5 h-5 text-purple-primary" />
            <h2 className="font-ui text-lg font-semibold text-ink">Popular questions</h2>
          </div>

          <ul className="space-y-3">
            {popularTopics.map((topic) => (
              <li key={topic.href}>
                <Link
                  href={topic.href}
                  className="flex items-center justify-between py-2 text-ink/80 hover:text-purple-primary transition-colors group"
                >
                  <span className="font-body text-[0.95rem]">{topic.label}</span>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="w-3 h-3 text-muted/40 group-hover:text-purple-primary group-hover:translate-x-1 transition-all"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quick Links */}
      <section className="px-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-black/5 p-6">
            <FontAwesomeIcon icon={faBook} className="w-8 h-8 text-purple-primary/60 mb-4" />
            <h3 className="font-ui text-lg font-semibold text-ink mb-2">Community Guidelines</h3>
            <p className="font-body text-sm text-muted mb-4">
              Learn about the rules and standards that keep PinkQuill a positive space for creators.
            </p>
            <Link href="/terms" className="font-ui text-sm text-purple-primary hover:underline">
              Read guidelines
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 p-6">
            <FontAwesomeIcon icon={faShield} className="w-8 h-8 text-purple-primary/60 mb-4" />
            <h3 className="font-ui text-lg font-semibold text-ink mb-2">Privacy Policy</h3>
            <p className="font-body text-sm text-muted mb-4">
              Understand how we collect, use, and protect your personal information.
            </p>
            <Link href="/privacy" className="font-ui text-sm text-purple-primary hover:underline">
              Read policy
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="px-6 max-w-3xl mx-auto mt-16 text-center">
        <p className="font-body text-muted mb-4">
          Can't find what you're looking for?
        </p>
        <a
          href="mailto:support@pinkquill.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-medium hover:shadow-lg hover:shadow-pink-vivid/30 transition-all"
        >
          <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" />
          Contact Support
        </a>
      </section>
    </div>
  );
}
