"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartLine, faEye, faUsers, faHeart, faArrowUp } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "overview", label: "Insights Overview" },
  { id: "dashboard", label: "Dashboard" },
  { id: "key-metrics", label: "Key Metrics" },
  { id: "content-analytics", label: "Content Analytics" },
  { id: "audience", label: "Audience Insights" },
  { id: "using-insights", label: "Using Your Insights" },
];

export default function InsightsHelpPage() {
  const [activeSection, setActiveSection] = useState("overview");

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
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faChartLine} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Insights & Analytics</h1>
            <p className="font-body text-muted">Understand your reach and impact</p>
          </div>
        </div>
      </header>

      <div className="flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden xl:block w-48 flex-shrink-0">
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
                    <span className="font-body text-[0.85rem]">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <article className="flex-1 help-content">
          <section id="overview" className="scroll-mt-24 mb-16">
            <h2>Insights Overview</h2>
            <p>
              PinkQuill Insights helps you understand how your content performs and how your
              audience engages with your work. Use these analytics to make informed
              decisions about your creative strategy.
            </p>

            <h3>Accessing insights</h3>
            <p>
              Go to <Link href="/insights" className="text-purple-primary hover:underline">Insights</Link>{" "}
              from your sidebar or profile menu. You'll see a dashboard with your key metrics
              and detailed breakdowns.
            </p>

            <h3>What you'll learn</h3>
            <ul>
              <li>How many people view your content</li>
              <li>Which posts perform best</li>
              <li>How your audience is growing</li>
              <li>When your audience is most active</li>
              <li>What type of content resonates</li>
            </ul>
          </section>

          <section id="dashboard" className="scroll-mt-24 mb-16">
            <h2>Dashboard</h2>
            <p>
              The insights dashboard gives you an at-a-glance view of your performance.
            </p>

            <h3>Time range</h3>
            <p>
              Use the date picker to view metrics for different periods:
            </p>
            <ul>
              <li><strong>Last 7 days</strong> — Recent short-term trends</li>
              <li><strong>Last 30 days</strong> — Monthly overview</li>
              <li><strong>Last 90 days</strong> — Quarterly trends</li>
              <li><strong>Custom</strong> — Select specific date ranges</li>
            </ul>

            <h3>Dashboard sections</h3>
            <ul>
              <li><strong>Key metrics</strong> — Top-level numbers (views, reach, engagement)</li>
              <li><strong>Charts</strong> — Visual trends over time</li>
              <li><strong>Top content</strong> — Your best-performing posts</li>
              <li><strong>Audience</strong> — Follower growth and demographics</li>
            </ul>
          </section>

          <section id="key-metrics" className="scroll-mt-24 mb-16">
            <h2>Key Metrics</h2>
            <p>
              Understanding what each metric means helps you interpret your performance.
            </p>

            <div className="space-y-4 my-6">
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faEye} className="w-5 h-5 text-purple-primary mt-0.5" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Views</h4>
                  <p className="font-body text-sm text-muted mb-0">
                    Total number of times your content was viewed. Includes multiple views
                    from the same person.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-purple-primary mt-0.5" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Reach</h4>
                  <p className="font-body text-sm text-muted mb-0">
                    Number of unique accounts that saw your content. Unlike views, each
                    person is counted only once.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faHeart} className="w-5 h-5 text-purple-primary mt-0.5" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Engagement Rate</h4>
                  <p className="font-body text-sm text-muted mb-0">
                    Percentage of people who interacted with your content (reactions,
                    comments, saves, relays) divided by reach. Higher is better.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faArrowUp} className="w-5 h-5 text-purple-primary mt-0.5" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Follower Growth</h4>
                  <p className="font-body text-sm text-muted mb-0">
                    Net change in followers (new followers minus unfollows) over the period.
                    Shows your audience growth trajectory.
                  </p>
                </div>
              </div>
            </div>

            <h3>Understanding changes</h3>
            <p>
              Metrics include comparison to the previous period (shown as a percentage
              change). Green indicates growth, red indicates decline. Some fluctuation
              is normal.
            </p>
          </section>

          <section id="content-analytics" className="scroll-mt-24 mb-16">
            <h2>Content Analytics</h2>
            <p>
              Dive deeper into how individual pieces of content perform.
            </p>

            <h3>Content overview</h3>
            <p>
              At <Link href="/insights/content" className="text-purple-primary hover:underline">Insights → Content</Link>,
              you'll see:
            </p>
            <ul>
              <li>List of all your posts and takes</li>
              <li>Performance metrics for each</li>
              <li>Sorting by views, engagement, date</li>
              <li>Filter by content type (posts vs. takes)</li>
            </ul>

            <h3>Individual post analytics</h3>
            <p>Click on any post to see detailed metrics:</p>
            <ul>
              <li><strong>Total views</strong> — How many times it was viewed</li>
              <li><strong>Unique views</strong> — How many different people viewed it</li>
              <li><strong>Reactions</strong> — Breakdown by reaction type</li>
              <li><strong>Comments</strong> — Total comments received</li>
              <li><strong>Saves</strong> — How many people bookmarked it</li>
              <li><strong>Relays</strong> — How many times it was shared</li>
              <li><strong>Traffic sources</strong> — Where viewers came from</li>
            </ul>

            <h3>What makes content successful</h3>
            <p>Look for patterns in your top-performing content:</p>
            <ul>
              <li>What topics resonate?</li>
              <li>What post types perform best?</li>
              <li>What time of day gets more engagement?</li>
              <li>What length works for your audience?</li>
            </ul>
          </section>

          <section id="audience" className="scroll-mt-24 mb-16">
            <h2>Audience Insights</h2>
            <p>
              Learn about the people who follow and engage with your content.
            </p>

            <h3>Follower growth</h3>
            <p>
              The follower growth chart shows how your audience has changed over time.
              You can see:
            </p>
            <ul>
              <li>New followers per day/week</li>
              <li>Unfollows (if any)</li>
              <li>Net growth trend</li>
              <li>Total follower count over time</li>
            </ul>

            <h3>Audience activity</h3>
            <p>
              Understand when your audience is most active to optimize your posting
              schedule:
            </p>
            <ul>
              <li>Best days to post</li>
              <li>Peak activity hours</li>
              <li>Time zone distribution</li>
            </ul>

            <div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/10 my-6">
              <p className="font-ui text-sm text-ink mb-0">
                <strong>Tip:</strong> Post when your audience is active to maximize initial
                engagement, which can help your content reach more people.
              </p>
            </div>
          </section>

          <section id="using-insights" className="scroll-mt-24 mb-16">
            <h2>Using Your Insights</h2>
            <p>
              Data is only valuable if you use it to improve. Here's how to act on
              your insights:
            </p>

            <h3>Identify what works</h3>
            <ul>
              <li>Look at your top 5 posts — what do they have in common?</li>
              <li>Note which post types get the most engagement</li>
              <li>Pay attention to topics that resonate</li>
            </ul>

            <h3>Experiment and iterate</h3>
            <ul>
              <li>Try new content types based on what's working</li>
              <li>Test different posting times</li>
              <li>Vary your content mix and measure results</li>
            </ul>

            <h3>Set goals</h3>
            <ul>
              <li>Aim for specific engagement rate improvements</li>
              <li>Set follower growth targets</li>
              <li>Track progress over time</li>
            </ul>

            <h3>Don't obsess over numbers</h3>
            <p>
              While insights are useful, remember that creative expression shouldn't
              be solely driven by metrics. Create what matters to you, and use insights
              to understand how to share it more effectively.
            </p>
          </section>
        </article>
      </div>

      <style jsx global>{`
        .help-content h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 500;
          color: var(--ink);
          margin-bottom: 1rem;
        }
        .help-content h3 {
          font-family: var(--font-ui);
          font-size: 1rem;
          font-weight: 600;
          color: var(--ink);
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .help-content h4 {
          font-family: var(--font-ui);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--ink);
        }
        .help-content p {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.75;
          color: #4a4a4a;
          margin-bottom: 1rem;
        }
        .help-content ul, .help-content ol {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        .help-content li {
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.7;
          color: #4a4a4a;
          margin-bottom: 0.5rem;
        }
        .help-content ol { list-style: decimal; }
        .help-content ul { list-style: disc; }
        .help-content strong { font-weight: 600; color: var(--ink); }
      `}</style>
    </div>
  );
}
