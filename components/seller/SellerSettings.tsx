"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  useSellerProfile,
  useUpdateSellerProfile,
  type SellerProfile,
} from "@/lib/hooks/useSellerProfile";

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
  { value: "professional", label: "Professional" },
];

const SKILL_SUGGESTIONS = [
  "Photoshop", "Illustrator", "Procreate", "Blender",
  "After Effects", "Premiere Pro", "Figma", "Watercolor",
  "Oil Painting", "Pencil Drawing", "Ink", "Acrylic",
  "Digital Sculpture", "Character Rigging", "Motion Graphics",
];

const SERVICE_SUGGESTIONS = [
  "Custom Portraits", "Logo Design", "Book Covers", "Album Art",
  "Character Design", "Concept Art", "Storyboarding", "Editing",
  "Ghost Writing", "Proofreading", "Voice Over", "Music Production",
  "Video Editing", "Photography Sessions", "Print Design",
];

function TagInput({
  label,
  tags,
  onChange,
  suggestions,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (suggestion) => !tags.includes(suggestion) && suggestion.toLowerCase().includes(input.toLowerCase())
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((current) => current !== tag));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "Enter" || event.key === ",") && input.trim()) {
      event.preventDefault();
      addTag(input);
    }

    if (event.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef}>
      <label className="block text-sm font-ui font-medium text-ink mb-1">{label}</label>
      <div className="relative">
        <div className="flex min-h-[48px] flex-wrap gap-1.5 rounded-xl border border-black/[0.08] p-3 focus-within:ring-2 focus-within:ring-purple-primary/20">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-purple-primary/10 px-2.5 py-1 text-xs font-ui text-purple-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="transition-colors hover:text-pink-vivid"
              >
                &times;
              </button>
            </span>
          ))}

          <input
            type="text"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="min-w-[120px] flex-1 bg-transparent text-sm font-body outline-none"
          />
        </div>

        {showSuggestions && filtered.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-xl border border-black/[0.06] bg-white shadow-lg shadow-black/[0.06]">
            {filtered.slice(0, 8).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  addTag(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full px-4 py-2 text-left text-sm font-body text-ink transition-colors hover:bg-purple-primary/[0.04]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SellerSettingsForm({
  userId,
  profile,
  onSaved,
}: {
  userId: string;
  profile: SellerProfile;
  onSaved: () => Promise<void>;
}) {
  const { update, updating, error } = useUpdateSellerProfile();
  const [saved, setSaved] = useState(false);
  const [storeName, setStoreName] = useState(profile.store_name || "");
  const [title, setTitle] = useState(profile.store_tagline || "");
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [services, setServices] = useState<string[]>(profile.services || []);
  const [experienceLevel, setExperienceLevel] = useState<string>(profile.experience_level || "");
  const [responseTimeHours, setResponseTimeHours] = useState(profile.response_time_hours || 24);
  const [isAcceptingCommissions, setIsAcceptingCommissions] = useState(profile.is_accepting_commissions);
  const [requireApproval, setRequireApproval] = useState(profile.require_approval);
  const [autoDeclineHours, setAutoDeclineHours] = useState(profile.auto_decline_hours || 72);

  const handleSave = async () => {
    setSaved(false);

    const result = await update(userId, {
      store_name: storeName,
      store_tagline: title || null,
      skills,
      services,
      experience_level: (experienceLevel || null) as SellerProfile["experience_level"],
      response_time_hours: responseTimeHours,
      is_accepting_commissions: isAcceptingCommissions,
      require_approval: requireApproval,
      auto_decline_hours: autoDeclineHours,
    });

    if (result) {
      setSaved(true);
      await onSaved();
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Seller Settings</h1>

      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg text-ink">Commissions Studio</h2>
          <p className="mt-0.5 text-xs font-body text-muted">
            This info will appear on your Commissions Studio banner
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-ui font-medium text-ink">Store Name</label>
          <input
            type="text"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            className="w-full rounded-xl border border-black/[0.08] px-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-ui font-medium text-ink">Title</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Graphic Designer and Cover Artist"
            className="w-full rounded-xl border border-black/[0.08] px-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-ui font-medium text-ink">Experience Level</label>
          <select
            value={experienceLevel}
            onChange={(event) => setExperienceLevel(event.target.value)}
            className="w-full rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          >
            <option value="">Not specified</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>

        <TagInput
          label="Skills"
          tags={skills}
          onChange={setSkills}
          suggestions={SKILL_SUGGESTIONS}
          placeholder="Type a skill and press Enter"
        />

        <TagInput
          label="Services"
          tags={services}
          onChange={setServices}
          suggestions={SERVICE_SUGGESTIONS}
          placeholder="Type a service and press Enter"
        />
      </section>

      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-5">
        <h2 className="font-display text-lg text-ink">Order Preferences</h2>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-ui font-medium text-ink">Accepting Commissions</p>
            <p className="mt-0.5 text-xs font-body text-muted">
              When off, buyers can still purchase products but cannot hire you for commissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAcceptingCommissions((value) => !value)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              isAcceptingCommissions ? "bg-purple-primary" : "bg-gray-300"
            }`}
          >
            <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isAcceptingCommissions ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-ui font-medium text-ink">Require Approval for Orders</p>
            <p className="mt-0.5 text-xs font-body text-muted">
              When enabled, new orders require your acceptance before the buyer is asked to pay.
              This gives you a chance to review commission briefs and physical product requests before committing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRequireApproval((value) => !value)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              requireApproval ? "bg-purple-primary" : "bg-gray-300"
            }`}
          >
            <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              requireApproval ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {requireApproval && (
          <div className="ml-4 border-l-2 border-purple-primary/20 pl-4">
            <label className="mb-1 block text-sm font-ui font-medium text-ink">
              Auto-decline after (hours)
            </label>
            <p className="mb-2 text-xs font-body text-muted">
              Orders you don&apos;t respond to within this time will be automatically declined.
            </p>
            <input
              type="number"
              min={1}
              max={720}
              value={autoDeclineHours}
              onChange={(event) => {
                const nextValue = Number(event.target.value || 72);
                setAutoDeclineHours(Math.max(1, Math.min(720, nextValue)));
              }}
              className="w-32 rounded-xl border border-black/[0.08] px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-ui font-medium text-ink">
            Average Response Time (hours)
          </label>
          <p className="mb-2 text-xs font-body text-muted">
            Displayed on your commission pages. Set this to how quickly you typically reply to buyers.
          </p>
          <input
            type="number"
            min={1}
            max={168}
            value={responseTimeHours}
            onChange={(event) => {
              const nextValue = Number(event.target.value || 24);
              setResponseTimeHours(Math.max(1, Math.min(168, nextValue)));
            }}
            className="w-32 rounded-xl border border-black/[0.08] px-4 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={updating || !storeName.trim()}
          className="rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid px-6 py-3 font-ui font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {updating ? "Saving..." : "Save Changes"}
        </button>

        {saved && (
          <span className="text-sm font-ui text-green-600">Settings saved!</span>
        )}
        {error && (
          <span className="text-sm font-body text-red-500">{error}</span>
        )}
      </div>
    </div>
  );
}

export default function SellerSettings() {
  const { user } = useAuth();
  const { profile, loading, refetch } = useSellerProfile(user?.id);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl text-ink">Seller Settings</h1>
        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 text-sm text-muted">
          Complete seller setup to manage your commissions studio settings.
        </div>
      </div>
    );
  }

  return (
    <SellerSettingsForm
      key={`${profile.id}:${profile.updated_at}`}
      userId={user.id}
      profile={profile}
      onSaved={refetch}
    />
  );
}
