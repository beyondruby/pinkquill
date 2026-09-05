"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCommunity } from "@/lib/hooks.legacy";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { ComposerSteps, FieldLabel } from "@/components/create/pieces";
import { COMMUNITY_CATEGORIES, COMMUNITY_PURPOSES, COMMUNITY_THEMES, findCategoryById } from "@/lib/communities/categories";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

const STEPS = [
  { n: 1, label: "Basics" },
  { n: 2, label: "What it's about" },
  { n: 3, label: "Rules and create" },
];

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

function ChipToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="pq-chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Three short steps: name and visibility; category, genres, themes and
 * purpose (the same taxonomy the directory filters on); rules and a summary.
 * Same fields, chips and steps as the composer.
 */
export default function CreateCommunityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { create, creating: loading, error } = useCreateCommunity();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    privacy: "public" as "public" | "private",
    category: null as string | null,
    selectedGenres: [] as string[],
    selectedThemes: [] as string[],
    customGenres: [] as string[],
    customThemes: [] as string[],
    newGenre: "",
    newTheme: "",
    communityType: null as string | null,
    rules: [] as { title: string; description: string }[],
  });
  const [newRule, setNewRule] = useState({ title: "", description: "" });

  const selectedCategory = findCategoryById(formData.category);

  const toggleIn = (key: "selectedGenres" | "selectedThemes", value: string) =>
    setFormData((prev) => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value] }));

  const addCustom = (kind: "genre" | "theme") => {
    const value = (kind === "genre" ? formData.newGenre : formData.newTheme).trim();
    if (!value) return;
    setFormData((prev) => {
      if (kind === "genre") {
        return prev.selectedGenres.includes(value)
          ? { ...prev, newGenre: "" }
          : { ...prev, selectedGenres: [...prev.selectedGenres, value], customGenres: [...prev.customGenres, value], newGenre: "" };
      }
      return prev.selectedThemes.includes(value)
        ? { ...prev, newTheme: "" }
        : { ...prev, selectedThemes: [...prev.selectedThemes, value], customThemes: [...prev.customThemes, value], newTheme: "" };
    });
  };

  const addRule = () => {
    if (!newRule.title.trim()) return;
    setFormData((prev) => ({ ...prev, rules: [...prev.rules, { title: newRule.title.trim(), description: newRule.description.trim() }] }));
    setNewRule({ title: "", description: "" });
  };

  const handleSubmit = async () => {
    if (!user) return;
    const tags = [
      ...formData.selectedGenres.map((tag) => ({ tag, tag_type: "genre" })),
      ...formData.selectedThemes.map((tag) => ({ tag, tag_type: "theme" })),
      ...(formData.communityType ? [{ tag: formData.communityType, tag_type: "type" }] : []),
    ];
    const result = await create(
      {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        privacy: formData.privacy,
        topics: selectedCategory ? [selectedCategory.name] : [],
        tags,
        rules: formData.rules,
      },
      user.id
    );
    if (result.success && result.community) router.push(`/community/${result.community.slug}`);
  };

  if (authLoading) {
    return (
      <PageFrame width="reading">
        <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
      </PageFrame>
    );
  }

  if (!user) {
    return (
      <PageFrame width="narrow">
        <PageHeader title="Start a community" />
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Sign in to start a community</p>
          <p className="pq-feed-state__text">A community is a shared space you run for your kind of work.</p>
          <div className="pq-feed-state__actions">
            <Link href="/login?redirect=%2Fcommunity%2Fcreate" className="pq-button pq-button--md pq-button--primary">Sign in</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  const canContinue1 = formData.name.trim().length > 0 && formData.slug.trim().length > 0;

  return (
    <PageFrame width="reading" className="pq-composer">
      <PageHeader
        title="Start a community"
        lede="Give it a name and a purpose. You can change everything later in its settings."
        actions={<Link href="/community" className="pq-button pq-button--sm pq-button--ghost">Cancel</Link>}
      />

      <ComposerSteps steps={STEPS} current={step} onSelect={(n) => n < step && setStep(n)} />

      {step === 1 && (
        <div className="grid gap-5">
          <div>
            <FieldLabel htmlFor="community-name">Name</FieldLabel>
            <input
              id="community-name"
              type="text"
              className="pq-field"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value, slug: slugify(e.target.value) }))}
              placeholder="What people will call it"
              maxLength={100}
              autoFocus
            />
          </div>
          <div>
            <FieldLabel htmlFor="community-slug" hint="pinkquill.com/community/…">Address</FieldLabel>
            <input
              id="community-slug"
              type="text"
              className="pq-field pq-field--ui"
              value={formData.slug}
              onChange={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              placeholder="community-name"
              maxLength={50}
            />
          </div>
          <div>
            <FieldLabel htmlFor="community-description" hint={`(optional) ${formData.description.length}/500`}>What it&rsquo;s for</FieldLabel>
            <textarea
              id="community-description"
              className="pq-field"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Who it's for and what gets shared here."
              rows={3}
              maxLength={500}
            />
          </div>
          <div>
            <p className="pq-label">Who can join</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who can join">
              {[
                { id: "public" as const, label: "Public", desc: "Anyone can join and see the posts." },
                { id: "private" as const, label: "Private", desc: "People ask to join; admins approve." },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={formData.privacy === option.id}
                  className="pq-choice"
                  style={formData.privacy === option.id ? { borderColor: "var(--color-action)", background: "var(--color-action-soft)" } : undefined}
                  onClick={() => setFormData((prev) => ({ ...prev, privacy: option.id }))}
                >
                  <span>
                    <strong className="block font-semibold">{option.label}</strong>
                    <span className="text-sm text-subdued">{option.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="pq-composer-foot">
            <div className="pq-composer-foot__audience" />
            <div className="pq-composer-foot__actions">
              <Button variant="primary" onClick={() => setStep(2)} disabled={!canContinue1}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6">
          <div>
            <p className="pq-label">Category</p>
            <div className="pq-chip-row" role="group" aria-label="Category">
              {COMMUNITY_CATEGORIES.map((category) => (
                <ChipToggle
                  key={category.id}
                  pressed={formData.category === category.id}
                  onClick={() => setFormData((prev) => ({ ...prev, category: prev.category === category.id ? null : category.id, selectedGenres: prev.category === category.id ? prev.selectedGenres : [] }))}
                >
                  {category.name}
                </ChipToggle>
              ))}
            </div>
          </div>

          {selectedCategory && (
            <>
              <div>
                <FieldLabel htmlFor="community-genre" hint={formData.selectedGenres.length ? `${formData.selectedGenres.length} chosen` : "(optional)"}>Genres</FieldLabel>
                <div className="pq-chip-row mb-2" role="group" aria-label="Genres">
                  {[...selectedCategory.genres, ...formData.customGenres.filter((g) => !selectedCategory.genres.includes(g))].map((genre) => (
                    <ChipToggle key={genre} pressed={formData.selectedGenres.includes(genre)} onClick={() => toggleIn("selectedGenres", genre)}>{genre}</ChipToggle>
                  ))}
                </div>
                <input
                  id="community-genre"
                  type="text"
                  className="pq-field pq-field--ui"
                  value={formData.newGenre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, newGenre: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom("genre"); } }}
                  placeholder="Add your own and press Enter"
                />
              </div>

              <div>
                <FieldLabel htmlFor="community-theme" hint={formData.selectedThemes.length ? `${formData.selectedThemes.length} chosen` : "(optional)"}>Themes</FieldLabel>
                <div className="pq-chip-row mb-2" role="group" aria-label="Themes">
                  {[...COMMUNITY_THEMES, ...formData.customThemes.filter((t) => !COMMUNITY_THEMES.includes(t))].map((theme) => (
                    <ChipToggle key={theme} pressed={formData.selectedThemes.includes(theme)} onClick={() => toggleIn("selectedThemes", theme)}>{theme}</ChipToggle>
                  ))}
                </div>
                <input
                  id="community-theme"
                  type="text"
                  className="pq-field pq-field--ui"
                  value={formData.newTheme}
                  onChange={(e) => setFormData((prev) => ({ ...prev, newTheme: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom("theme"); } }}
                  placeholder="Add your own and press Enter"
                />
              </div>

              <div>
                <p className="pq-label">Purpose <span className="pq-label__hint">(optional)</span></p>
                <div className="pq-chip-row" role="group" aria-label="Purpose">
                  {COMMUNITY_PURPOSES.map((type) => (
                    <ChipToggle key={type.id} pressed={formData.communityType === type.id} onClick={() => setFormData((prev) => ({ ...prev, communityType: prev.communityType === type.id ? null : type.id }))}>
                      {type.name}
                    </ChipToggle>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="pq-composer-foot">
            <div className="pq-composer-foot__audience">
              {!selectedCategory && <span className="text-sm text-subdued">Pick a category so people can find it.</span>}
            </div>
            <div className="pq-composer-foot__actions">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" onClick={() => setStep(3)} disabled={!formData.category}>Next</Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6">
          <div>
            <p className="pq-label">Rules <span className="pq-label__hint">(optional)</span></p>
            {formData.rules.length > 0 && (
              <ol className="grid gap-2 mb-3 list-none p-0 m-0">
                {formData.rules.map((rule, index) => (
                  <li key={`${rule.title}-${index}`} className="pq-rule">
                    <span className="pq-rule__num">{index + 1}</span>
                    <span className="pq-rule__text">
                      {rule.title}
                      {rule.description && <small>{rule.description}</small>}
                    </span>
                    <button type="button" className="pq-icon-button" onClick={() => setFormData((prev) => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }))} aria-label={`Remove rule ${index + 1}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="pq-panel grid gap-2">
              <input
                type="text"
                className="pq-field pq-field--ui"
                value={newRule.title}
                onChange={(e) => setNewRule((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="A rule, in a few words"
                aria-label="Rule"
              />
              <textarea
                className="pq-field"
                value={newRule.description}
                onChange={(e) => setNewRule((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Why it matters here (optional)"
                aria-label="Rule description"
                rows={2}
              />
              <div>
                <Button variant="secondary" size="sm" onClick={addRule} disabled={!newRule.title.trim()}>Add rule</Button>
              </div>
            </div>
          </div>

          <div>
            <p className="pq-label">Summary</p>
            <dl className="pq-summary">
              <div><dt>Name</dt><dd>{formData.name}</dd></div>
              <div><dt>Address</dt><dd>/community/{formData.slug}</dd></div>
              <div><dt>Category</dt><dd>{selectedCategory?.name}</dd></div>
              {formData.selectedGenres.length > 0 && (
                <div><dt>Genres</dt><dd>{formData.selectedGenres.slice(0, 3).join(", ")}{formData.selectedGenres.length > 3 ? ` +${formData.selectedGenres.length - 3}` : ""}</dd></div>
              )}
              <div><dt>Who can join</dt><dd>{formData.privacy === "private" ? "Private, by request" : "Public"}</dd></div>
              <div><dt>Rules</dt><dd>{formData.rules.length || "None yet"}</dd></div>
            </dl>
          </div>

          {error && <p className="pq-alert" role="alert">{error}</p>}

          <div className="pq-composer-foot">
            <div className="pq-composer-foot__audience">
              <span className="text-sm text-subdued">You&rsquo;ll be the admin. Rules and members are managed in Settings.</span>
            </div>
            <div className="pq-composer-foot__actions">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={loading}>Back</Button>
              <Button variant="primary" onClick={handleSubmit} loading={loading} loadingText="Creating…">Create community</Button>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
}
