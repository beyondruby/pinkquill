"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerProfile, useUpdateSellerProfile } from "@/lib/hooks/useSellerProfile";

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
  { value: "professional", label: "Professional" },
];

export default function SellerSettings() {
  const { user } = useAuth();
  const { profile, loading, refetch } = useSellerProfile(user?.id);
  const { update, updating, error } = useUpdateSellerProfile();
  const [saved, setSaved] = useState(false);

  // Local state
  const [storeName, setStoreName] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<string>("");
  const [responseTimeHours, setResponseTimeHours] = useState(24);
  const [isAcceptingCommissions, setIsAcceptingCommissions] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [autoDeclineHours, setAutoDeclineHours] = useState(72);
  const [location, setLocation] = useState("");

  // Populate from profile
  useEffect(() => {
    if (profile) {
      setStoreName(profile.store_name || "");
      setStoreTagline(profile.store_tagline || "");
      setStoreDescription(profile.store_description || "");
      setExperienceLevel(profile.experience_level || "");
      setResponseTimeHours(profile.response_time_hours || 24);
      setIsAcceptingCommissions(profile.is_accepting_commissions);
      setRequireApproval(profile.require_approval);
      setAutoDeclineHours(profile.auto_decline_hours || 72);
      setLocation(profile.location || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaved(false);

    const result = await update(user.id, {
      store_name: storeName,
      store_tagline: storeTagline || null,
      store_description: storeDescription || null,
      experience_level: (experienceLevel || null) as "beginner" | "intermediate" | "expert" | "professional" | null,
      response_time_hours: responseTimeHours,
      is_accepting_commissions: isAcceptingCommissions,
      require_approval: requireApproval,
      auto_decline_hours: autoDeclineHours,
      location: location || null,
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

      {/* Store Profile */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-lg text-ink">Store Profile</h2>

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
          <label className="block text-sm font-ui font-medium text-ink mb-1">Tagline</label>
          <input
            type="text"
            value={storeTagline}
            onChange={(e) => setStoreTagline(e.target.value)}
            placeholder="Short description of your creative work"
            className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-ui font-medium text-ink mb-1">Description</label>
          <textarea
            rows={4}
            value={storeDescription}
            onChange={(e) => setStoreDescription(e.target.value)}
            placeholder="Tell buyers about your creative practice, experience, and what makes your work unique..."
            className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-ui font-medium text-ink mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
            />
          </div>
        </div>
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
