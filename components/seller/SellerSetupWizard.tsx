"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUpdateSellerProfile } from "@/lib/hooks/useSellerProfile";
import { useSellerOnboarding } from "@/lib/hooks/usePayments";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore,
  faPalette,
  faClock,
  faCreditCard,
  faCheck,
  faArrowRight,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";

// ============================================================================
// WIZARD STATE
// ============================================================================

interface WizardState {
  storeName: string;
  storeTagline: string;
  storeDescription: string;
  specialties: string[];
  skills: string[];
  services: string[];
  experienceLevel: "beginner" | "intermediate" | "expert" | "professional" | "";
  responseTimeHours: number;
  isAcceptingCommissions: boolean;
  requireApproval: boolean;
  autoDeclineHours: number;
  languages: string[];
  location: string;
}

const initialState: WizardState = {
  storeName: "",
  storeTagline: "",
  storeDescription: "",
  specialties: [],
  skills: [],
  services: [],
  experienceLevel: "",
  responseTimeHours: 24,
  isAcceptingCommissions: true,
  requireApproval: false,
  autoDeclineHours: 72,
  languages: [],
  location: "",
};

const STEPS = [
  { label: "Store Basics", icon: faStore },
  { label: "Services & Skills", icon: faPalette },
  { label: "Availability", icon: faClock },
  { label: "Payment", icon: faCreditCard },
];

const SPECIALTY_OPTIONS = [
  "Illustration", "Digital Art", "Traditional Painting", "Photography",
  "Graphic Design", "3D Art", "Animation", "Character Design",
  "Logo Design", "Calligraphy", "Mixed Media", "Sculpture",
  "Poetry", "Fiction Writing", "Non-Fiction", "Screenwriting",
  "Music Composition", "Voice Acting", "Video Editing",
];

const SKILL_OPTIONS = [
  "Photoshop", "Illustrator", "Procreate", "Blender",
  "After Effects", "Premiere Pro", "Figma", "Watercolor",
  "Oil Painting", "Pencil Drawing", "Ink", "Acrylic",
  "Digital Sculpture", "Character Rigging", "Motion Graphics",
];

const SERVICE_OPTIONS = [
  "Custom Portraits", "Logo Design", "Book Covers", "Album Art",
  "Character Design", "Concept Art", "Storyboarding", "Editing",
  "Ghost Writing", "Proofreading", "Voice Over", "Music Production",
  "Video Editing", "Photography Sessions", "Print Design",
];

const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "German", "Portuguese",
  "Italian", "Japanese", "Korean", "Chinese", "Arabic",
  "Hindi", "Russian", "Dutch", "Swedish", "Turkish",
];

// ============================================================================
// TAG PICKER COMPONENT
// ============================================================================

function TagPicker({
  label,
  options,
  selected,
  onToggle,
  allowCustom = true,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  allowCustom?: boolean;
}) {
  const [customInput, setCustomInput] = useState("");

  return (
    <div>
      <label className="block text-sm font-medium text-ink/70 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selected.includes(opt)
                ? "bg-[var(--color-purple-primary)] text-white"
                : "bg-skeleton/70 text-ink/60 hover:bg-skeleton"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Add custom..."
            className="flex-1 rounded-lg border border-border-light px-3 py-1.5 text-sm focus:border-[var(--color-purple-primary)] outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && customInput.trim()) {
                e.preventDefault();
                if (!selected.includes(customInput.trim())) {
                  onToggle(customInput.trim());
                }
                setCustomInput("");
              }
            }}
          />
        </div>
      )}
      {selected.filter((s) => !options.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.filter((s) => !options.includes(s)).map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--color-purple-primary)] text-white"
            >
              {s}
              <button onClick={() => onToggle(s)} className="hover:text-white/70">&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function StoreBasicsStep({ state, setState }: { state: WizardState; setState: (s: WizardState) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink/70 mb-1">Store Name *</label>
        <input
          type="text"
          value={state.storeName}
          onChange={(e) => setState({ ...state, storeName: e.target.value })}
          placeholder="e.g., Ruby's Art Studio"
          className="w-full rounded-lg border border-border-light px-4 py-2.5 text-sm focus:border-[var(--color-purple-primary)] focus:ring-1 focus:ring-[var(--color-purple-primary)] outline-none"
          maxLength={60}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink/70 mb-1">Tagline</label>
        <input
          type="text"
          value={state.storeTagline}
          onChange={(e) => setState({ ...state, storeTagline: e.target.value })}
          placeholder="e.g., Bringing stories to life through art"
          className="w-full rounded-lg border border-border-light px-4 py-2.5 text-sm focus:border-[var(--color-purple-primary)] outline-none"
          maxLength={120}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink/70 mb-1">About Your Store</label>
        <textarea
          value={state.storeDescription}
          onChange={(e) => setState({ ...state, storeDescription: e.target.value })}
          placeholder="Tell buyers about your work, experience, and what makes your creations special..."
          rows={4}
          className="w-full rounded-lg border border-border-light px-4 py-2.5 text-sm focus:border-[var(--color-purple-primary)] outline-none resize-none"
          maxLength={1000}
        />
        <p className="text-xs text-muted/60 mt-1">{state.storeDescription.length}/1000</p>
      </div>
    </div>
  );
}

function ServicesSkillsStep({ state, setState }: { state: WizardState; setState: (s: WizardState) => void }) {
  const toggleTag = (list: string[], tag: string) =>
    list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];

  return (
    <div className="space-y-6">
      <TagPicker
        label="Specialties"
        options={SPECIALTY_OPTIONS}
        selected={state.specialties}
        onToggle={(t) => setState({ ...state, specialties: toggleTag(state.specialties, t) })}
      />
      <TagPicker
        label="Skills & Tools"
        options={SKILL_OPTIONS}
        selected={state.skills}
        onToggle={(t) => setState({ ...state, skills: toggleTag(state.skills, t) })}
      />
      <TagPicker
        label="Services Offered"
        options={SERVICE_OPTIONS}
        selected={state.services}
        onToggle={(t) => setState({ ...state, services: toggleTag(state.services, t) })}
      />
      <div>
        <label className="block text-sm font-medium text-ink/70 mb-2">Experience Level</label>
        <div className="grid grid-cols-2 gap-2">
          {(["beginner", "intermediate", "expert", "professional"] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setState({ ...state, experienceLevel: level })}
              className={`px-4 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                state.experienceLevel === level
                  ? "border-[var(--color-purple-primary)] bg-accent/10 text-[var(--color-purple-primary)]"
                  : "border-border-light text-ink/60 hover:bg-subtle"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvailabilityStep({ state, setState }: { state: WizardState; setState: (s: WizardState) => void }) {
  const toggleTag = (list: string[], tag: string) =>
    list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border-light p-4">
        <div>
          <p className="text-sm font-medium text-ink">Accepting Commissions</p>
          <p className="text-xs text-muted">Allow buyers to hire you for custom work</p>
        </div>
        <button
          type="button"
          onClick={() => setState({ ...state, isAcceptingCommissions: !state.isAcceptingCommissions })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            state.isAcceptingCommissions ? "bg-[var(--color-purple-primary)]" : "bg-border-strong"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
              state.isAcceptingCommissions ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border-light p-4">
        <div>
          <p className="text-sm font-medium text-ink">Require Approval Before Payment</p>
          <p className="text-xs text-muted">
            Applies to commissions and physical product orders only. Buyers pay only after you accept.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState({ ...state, requireApproval: !state.requireApproval })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            state.requireApproval ? "bg-[var(--color-purple-primary)]" : "bg-border-strong"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
              state.requireApproval ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {state.requireApproval && (
        <div>
          <label className="block text-sm font-medium text-ink/70 mb-2">Auto-decline timeout (hours)</label>
          <input
            type="number"
            min={1}
            max={720}
            value={state.autoDeclineHours}
            onChange={(e) => setState({ ...state, autoDeclineHours: Math.max(1, Math.min(720, Number(e.target.value || 72))) })}
            className="w-40 rounded-lg border border-border-light px-4 py-2.5 text-sm focus:border-[var(--color-purple-primary)] outline-none"
          />
          <p className="mt-1 text-xs text-muted">
            Orders without a response in this window are automatically declined.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-ink/70 mb-2">Typical Response Time</label>
        <select
          value={state.responseTimeHours}
          onChange={(e) => setState({ ...state, responseTimeHours: Number(e.target.value) })}
          className="w-full rounded-lg border border-border-light px-4 py-2.5 text-sm focus:border-[var(--color-purple-primary)] outline-none"
        >
          <option value={1}>Within 1 hour</option>
          <option value={4}>Within 4 hours</option>
          <option value={12}>Within 12 hours</option>
          <option value={24}>Within 24 hours</option>
          <option value={48}>Within 2 days</option>
          <option value={72}>Within 3 days</option>
        </select>
      </div>

      <TagPicker
        label="Languages"
        options={LANGUAGE_OPTIONS}
        selected={state.languages}
        onToggle={(t) => setState({ ...state, languages: toggleTag(state.languages, t) })}
        allowCustom={false}
      />

      <div>
        <label className="block text-sm font-medium text-ink/70 mb-1">Location (optional)</label>
        <input
          type="text"
          value={state.location}
          onChange={(e) => setState({ ...state, location: e.target.value })}
          placeholder="e.g., Toronto, Canada"
          className="w-full rounded-lg border border-border-light px-4 py-2.5 text-sm focus:border-[var(--color-purple-primary)] outline-none"
        />
      </div>
    </div>
  );
}

function PaymentStep({ onStartOnboarding, onboardingLoading }: { onStartOnboarding: () => void; onboardingLoading: boolean }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-purple-primary/10 rounded-full flex items-center justify-center mx-auto">
        <FontAwesomeIcon icon={faCreditCard} className="text-2xl text-[var(--color-purple-primary)]" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Set Up Payments</h3>
        <p className="text-sm text-ink/60">
          Connect your payment account to start receiving earnings. You can also skip this step and set it up later.
        </p>
      </div>
      <div className="bg-subtle rounded-lg p-4 text-left text-sm space-y-2">
        <div className="flex items-start gap-2">
          <FontAwesomeIcon icon={faCheck} className="text-emerald-500 mt-0.5 text-xs" />
          <span>Quill charges 5% on all sales</span>
        </div>
        <div className="flex items-start gap-2">
          <FontAwesomeIcon icon={faCheck} className="text-emerald-500 mt-0.5 text-xs" />
          <span>Secure payment processing via Stripe</span>
        </div>
        <div className="flex items-start gap-2">
          <FontAwesomeIcon icon={faCheck} className="text-emerald-500 mt-0.5 text-xs" />
          <span>Escrow protection for commissions</span>
        </div>
      </div>
      <button
        onClick={onStartOnboarding}
        disabled={onboardingLoading}
        className="w-full px-6 py-3 bg-[var(--color-purple-primary)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {onboardingLoading ? "Redirecting..." : "Connect Payment Account"}
      </button>
    </div>
  );
}

// ============================================================================
// MAIN WIZARD
// ============================================================================

export default function SellerSetupWizard() {
  const router = useRouter();
  const { profile: userProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => ({
    ...initialState,
    storeName: userProfile?.display_name
      ? `${userProfile.display_name}'s Studio`
      : "",
  }));
  const { updating, error, create, update } = useUpdateSellerProfile();
  const { startOnboarding, loading: onboardingLoading } = useSellerOnboarding();

  const canProceed = (): boolean => {
    if (step === 0) return state.storeName.trim().length >= 2;
    return true;
  };

  const handleNext = useCallback(async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
  }, [step]);

  const handleFinish = useCallback(async (skipPayment = false) => {
    if (!userProfile?.id) return;

    const profileData = {
      store_name: state.storeName.trim(),
      store_tagline: state.storeTagline.trim() || null,
      store_description: state.storeDescription.trim() || null,
      specialties: state.specialties,
      skills: state.skills,
      services: state.services,
      experience_level: state.experienceLevel || null,
      response_time_hours: state.responseTimeHours,
      is_accepting_commissions: state.isAcceptingCommissions,
      require_approval: state.requireApproval,
      auto_decline_hours: state.autoDeclineHours,
      languages: state.languages,
      location: state.location.trim() || null,
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
    };

    const result = await create(userProfile.id, profileData as typeof profileData & { store_name: string });
    if (!result) {
      // Maybe already exists, try update
      const updated = await update(userProfile.id, profileData);
      if (!updated) return;
    }

    if (skipPayment) {
      router.push("/seller/dashboard");
    } else {
      startOnboarding();
    }
  }, [state, userProfile, create, update, router, startOnboarding]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i < step
                    ? "bg-emerald-500 text-white"
                    : i === step
                      ? "bg-[var(--color-purple-primary)] text-white"
                      : "bg-skeleton text-muted"
                }`}
              >
                {i < step ? <FontAwesomeIcon icon={faCheck} /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                i === step ? "text-[var(--color-purple-primary)]" : "text-muted"
              }`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-1 ${i < step ? "bg-emerald-500" : "bg-skeleton"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Title */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink">{STEPS[step].label}</h2>
        <p className="text-sm text-muted mt-1">
          {step === 0 && "Tell us about your creative studio."}
          {step === 1 && "What do you create? Help buyers find your work."}
          {step === 2 && "Set your availability and preferences."}
          {step === 3 && "Connect your payment account to receive earnings."}
        </p>
      </div>

      {/* Step Content */}
      <div className="bg-surface rounded-2xl border border-border-light p-6 mb-6">
        {step === 0 && <StoreBasicsStep state={state} setState={setState} />}
        {step === 1 && <ServicesSkillsStep state={state} setState={setState} />}
        {step === 2 && <AvailabilityStep state={state} setState={setState} />}
        {step === 3 && (
          <PaymentStep
            onStartOnboarding={() => handleFinish(false)}
            onboardingLoading={onboardingLoading || updating}
          />
        )}
      </div>

      {/* Error */}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink/60 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
          Back
        </button>
        <div className="flex gap-3">
          {step === 3 && (
            <button
              onClick={() => handleFinish(true)}
              disabled={updating}
              className="px-5 py-2.5 text-sm font-medium text-ink/60 border border-border-strong rounded-lg hover:bg-subtle disabled:opacity-50"
            >
              Skip & Finish
            </button>
          )}
          {step < 3 && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Next
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
