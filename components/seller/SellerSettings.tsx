"use client";

import { useEffect, useState, useRef, type KeyboardEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerProfile, useUpdateSellerProfile } from "@/lib/hooks/useSellerProfile";

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
    (s) => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
        <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-black/[0.08] focus-within:ring-2 focus-within:ring-purple-primary/20 min-h-[48px]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-primary/10 text-purple-primary text-xs font-ui"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-pink-vivid transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] text-sm font-body outline-none bg-transparent"
          />
        </div>

        {showSuggestions && filtered.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-40 overflow-y-auto rounded-xl border border-black/[0.06] bg-white shadow-lg shadow-black/[0.06]">
            {filtered.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  addTag(s);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-purple-primary/[0.04] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SellerSettings() {
  const { user } = useAuth();
  const { profile, loading, refetch } = useSellerProfile(user?.id);
  const { update, updating, error } = useUpdateSellerProfile();
  const [saved, setSaved] = useState(false);

  // Local state
  const [storeName, setStoreName] = useState("");
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<string>("");
  const [responseTimeHours, setResponseTimeHours] = useState(24);
  const [isAcceptingCommissions, setIsAcceptingCommissions] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [autoDeclineHours, setAutoDeclineHours] = useState(72);

  // Populate from profile
  useEffect(() => {
    if (profile) {
      setStoreName(profile.store_name || "");
      setTitle(profile.store_tagline || "");
      setSkills(profile.skills || []);
      setServices(profile.services || []);
      setExperienceLevel(profile.experience_level || "");
      setResponseTimeHours(profile.response_time_hours || 24);
      setIsAcceptingCommissions(profile.is_accepting_commissions);
      setRequireApproval(profile.require_approval);
      setAutoDeclineHours(profile.auto_decline_hours || 72);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaved(false);

    const result = await update(user.id, {
      store_name: storeName,
      store_tagline: title || null,
      skills,
      services,
      experience_level: (experienceLevel || null) as "beginner" | "intermediate" | "expert" | "professional" | null,
      response_time_hours: responseTimeHours,
      is_accepting_commissions: isAcceptingCommissions,
      require_approval: requireApproval,
      auto_decline_hours: autoDeclineHours,
    });

    if (result) {
      setSaved(true);
      refetch();
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Seller Settings</h1>

      {/* Commissions Studio */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg text-ink">Commissions Studio</h2>
          <p className="text-xs font-body text-muted mt-0.5">This info will appear on your Commissions Studio banner</p>
        </div>

        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-1">Store Name</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Graphic Designer and Cover Artist"
            className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-1">Experience Level</label>
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20 bg-white"
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

      {/* Order Preferences */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-5">
        <h2 className="font-display text-lg text-ink">Order Preferences</h2>

        {/* Accepting commissions */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-ui font-medium text-ink">Accepting Commissions</p>
            <p className="text-xs font-body text-muted mt-0.5">
              When off, buyers can still purchase products but cannot hire you for commissions.
            </p>
          </div>
          <button
            onClick={() => setIsAcceptingCommissions(!isAcceptingCommissions)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              isAcceptingCommissions ? "bg-purple-primary" : "bg-gray-300"
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              isAcceptingCommissions ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* Require Approval */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-ui font-medium text-ink">Require Approval for Orders</p>
            <p className="text-xs font-body text-muted mt-0.5">
              When enabled, new orders require your acceptance before the buyer is asked to pay.
              This gives you a chance to review commission briefs and physical product requests before committing.
            </p>
          </div>
          <button
            onClick={() => setRequireApproval(!requireApproval)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              requireApproval ? "bg-purple-primary" : "bg-gray-300"
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              requireApproval ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* Auto-decline timeout */}
        {requireApproval && (
          <div className="ml-4 pl-4 border-l-2 border-purple-primary/20">
            <label className="block text-sm font-ui font-medium text-ink mb-1">
              Auto-decline after (hours)
            </label>
            <p className="text-xs font-body text-muted mb-2">
              Orders you don&apos;t respond to within this time will be automatically declined.
            </p>
            <input
              type="number"
              min={1}
              max={720}
              value={autoDeclineHours}
              onChange={(e) => setAutoDeclineHours(Math.max(1, Math.min(720, Number(e.target.value || 72))))}
              className="w-32 px-4 py-2.5 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
            />
          </div>
        )}

        {/* Response time */}
        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-1">
            Average Response Time (hours)
          </label>
          <p className="text-xs font-body text-muted mb-2">
            Displayed on your commission pages. Set this to how quickly you typically reply to buyers.
          </p>
          <input
            type="number"
            min={1}
            max={168}
            value={responseTimeHours}
            onChange={(e) => setResponseTimeHours(Math.max(1, Math.min(168, Number(e.target.value || 24))))}
            className="w-32 px-4 py-2.5 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={updating || !storeName.trim()}
          className="px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
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
