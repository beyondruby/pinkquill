"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCommission } from "@/lib/hooks/useCommissions";
import {
  type CommissionPackageFormState,
  type CommissionWizardState,
  initialCommissionWizardState,
} from "@/lib/types/store";
import {
  COMMISSION_CATEGORIES,
  getAllCommissionCategories,
} from "@/lib/commissions/categories";

const MAX_MEDIA = 10;
const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
];

const STEP_LABELS = [
  "Service Positioning",
  "Packages & Pricing",
  "Portfolio & Requirements",
  "Review & Publish",
];

const PACKAGE_PRESETS: Array<{ tier: CommissionPackageFormState["tier"]; name: string }> = [
  { tier: "basic", name: "Basic" },
  { tier: "standard", name: "Standard" },
  { tier: "premium", name: "Premium" },
];

export default function CreateCommissionWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, profile } = useAuth();
  const { createCommission, creating, error: createError } = useCreateCommission();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CommissionWizardState>(initialCommissionWizardState);

  const categories = useMemo(() => getAllCommissionCategories(), []);
  const selectedCategory = state.category ? COMMISSION_CATEGORIES[state.category] : null;

  const updateState = useCallback((updates: Partial<CommissionWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  const updatePackage = useCallback((id: string, updates: Partial<CommissionPackageFormState>) => {
    setState((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg) =>
        pkg.id === id ? { ...pkg, ...updates } : pkg
      ),
    }));
    setError(null);
  }, []);

  const addPackage = useCallback(() => {
    if (state.packages.length >= 3) return;

    const nextPreset = PACKAGE_PRESETS[state.packages.length];
    const nextPackage: CommissionPackageFormState = {
      id: nextPreset.tier,
      tier: nextPreset.tier,
      name: nextPreset.name,
      description: "",
      price: null,
      deliveryDays: 7,
      revisions: 1,
      features: [],
    };

    updateState({ packages: [...state.packages, nextPackage] });
  }, [state.packages, updateState]);

  const removePackage = useCallback((id: string) => {
    if (state.packages.length <= 1) return;
    updateState({ packages: state.packages.filter((pkg) => pkg.id !== id) });
  }, [state.packages, updateState]);

  const handleMediaUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const currentCount = state.mediaPreviews.length;
    const accepted: CommissionWizardState["mediaPreviews"] = [];

    for (const file of Array.from(files)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        setError("Use JPG, PNG, WEBP, GIF, or MP4/MOV media only.");
        continue;
      }

      if (currentCount + accepted.length >= MAX_MEDIA) {
        setError(`Maximum ${MAX_MEDIA} media files allowed.`);
        break;
      }

      accepted.push({
        file,
        url: URL.createObjectURL(file),
        isPrimary: currentCount === 0 && accepted.length === 0,
      });
    }

    if (accepted.length > 0) {
      updateState({ mediaPreviews: [...state.mediaPreviews, ...accepted] });
    }
  }, [state.mediaPreviews, updateState]);

  const setPrimaryMedia = useCallback((index: number) => {
    updateState({
      mediaPreviews: state.mediaPreviews.map((item, idx) => ({
        ...item,
        isPrimary: idx === index,
      })),
    });
  }, [state.mediaPreviews, updateState]);

  const removeMedia = useCallback((index: number) => {
    const item = state.mediaPreviews[index];
    if (item) URL.revokeObjectURL(item.url);

    const nextMedia = state.mediaPreviews.filter((_, idx) => idx !== index);
    if (nextMedia.length > 0 && !nextMedia.some((media) => media.isPrimary)) {
      nextMedia[0].isPrimary = true;
    }
    updateState({ mediaPreviews: nextMedia });
  }, [state.mediaPreviews, updateState]);

  const validateStep = useCallback((targetStep: number): boolean => {
    if (targetStep === 1) {
      if (!state.category) {
        setError("Select a commission category.");
        return false;
      }
      if (!state.title.trim()) {
        setError("Add a service title.");
        return false;
      }
    }

    if (targetStep === 2) {
      const hasValidPackage = state.packages.some(
        (pkg) => pkg.price !== null && pkg.price > 0 && pkg.description.trim().length > 0
      );

      if (!hasValidPackage) {
        setError("Add at least one package with description and price.");
        return false;
      }
    }

    if (targetStep === 3) {
      if (state.mediaPreviews.length === 0) {
        setError("Upload at least one portfolio image or video.");
        return false;
      }
    }

    return true;
  }, [state]);

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(4, prev + 1));
  };

  const goBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const publishService = useCallback(async () => {
    if (!user || !profile) {
      setError("Please sign in to publish your service.");
      return;
    }

    for (let idx = 1; idx <= 3; idx += 1) {
      if (!validateStep(idx)) {
        setStep(idx);
        return;
      }
    }

    const created = await createCommission(state);
    if (created) {
      router.push(`/studio/${profile.username}?tab=commissions`);
    }
  }, [createCommission, profile, router, state, user, validateStep]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-pink-50/40 flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center">
            <svg className="w-9 h-9 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-ink mb-3">Sign in to offer commissions</h1>
          <p className="font-body text-muted">Create service packages, set your timeline, and get hired from your studio and marketplace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-orange-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-12">
        <p className="text-xs font-ui font-semibold uppercase tracking-[0.2em] text-pink-vivid/70 text-center mb-3">
          Commission Studio
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-center text-ink mb-8">
          Build a service buyers can trust
        </h1>

        <StepRail currentStep={step} />

        {(error || createError) && (
          <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-body">
            {error || createError}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {step === 1 && (
            <section className="space-y-6">
              <SectionCard title="Category" description="Choose where your service will appear in commissions and marketplace.">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map((category) => {
                    const selected = state.category === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => updateState({ category: category.id, subcategory: null })}
                        className={`text-left p-4 rounded-2xl border transition-all ${
                          selected
                            ? "border-pink-vivid bg-pink-50/70 shadow-md shadow-pink-vivid/10"
                            : "border-black/[0.08] bg-white hover:border-pink-vivid/50"
                        }`}
                      >
                        <p className="font-ui font-semibold text-ink mb-1">{category.name}</p>
                        <p className="text-xs font-body text-muted">{category.description}</p>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {selectedCategory && (
                <SectionCard title="Specialization" description="Buyers filter by specialization first.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCategory.subcategories.map((subcategory) => {
                      const selected = state.subcategory === subcategory.value;
                      return (
                        <button
                          key={subcategory.value}
                          type="button"
                          onClick={() => updateState({ subcategory: subcategory.value })}
                          className={`text-left p-3.5 rounded-xl border transition-all ${
                            selected
                              ? "border-purple-primary bg-purple-50/60"
                              : "border-black/[0.08] hover:border-purple-primary/50"
                          }`}
                        >
                          <p className="font-ui text-sm font-semibold text-ink">{subcategory.label}</p>
                          <p className="text-xs font-body text-muted mt-1">{subcategory.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Positioning" description="Write clear positioning like top Fiverr/Upwork listings.">
                <div className="space-y-4">
                  <FieldLabel text="Service title" required />
                  <input
                    value={state.title}
                    onChange={(event) => updateState({ title: event.target.value })}
                    placeholder="I will design a conversion-ready landing page for your brand"
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
                  />

                  <FieldLabel text="Short headline" />
                  <input
                    value={state.headline}
                    onChange={(event) => updateState({ headline: event.target.value })}
                    placeholder="Fast delivery, strategic UX, and copy-ready handoff"
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid"
                  />

                  <FieldLabel text="Service description" required />
                  <textarea
                    rows={6}
                    value={state.description}
                    onChange={(event) => updateState({ description: event.target.value })}
                    placeholder="Describe your process, what buyers get, and why your approach is different."
                    className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid resize-y"
                  />
                </div>
              </SectionCard>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6">
              <SectionCard title="Package strategy" description="Offer structured options so buyers can choose based on scope and urgency.">
                <div className="space-y-4">
                  {state.packages.map((pkg, index) => (
                    <PackageEditor
                      key={pkg.id}
                      index={index}
                      pkg={pkg}
                      canRemove={state.packages.length > 1}
                      onRemove={() => removePackage(pkg.id)}
                      onChange={(updates) => updatePackage(pkg.id, updates)}
                    />
                  ))}

                  {state.packages.length < 3 && (
                    <button
                      type="button"
                      onClick={addPackage}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-ui font-medium text-purple-primary bg-purple-50 hover:bg-purple-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Package Tier
                    </button>
                  )}
                </div>
              </SectionCard>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <SectionCard title="Portfolio media" description="Show examples of delivered outcomes. First media becomes the cover.">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MEDIA_TYPES.join(",")}
                  multiple
                  onChange={(event) => handleMediaUpload(event.target.files)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-pink-vivid/30 rounded-2xl px-6 py-10 text-center hover:border-pink-vivid transition-colors"
                >
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-pink-vivid/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="font-ui font-medium text-ink">Upload Portfolio Media</p>
                  <p className="text-xs font-body text-muted mt-1">{state.mediaPreviews.length} / {MAX_MEDIA} added</p>
                </button>

                {state.mediaPreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {state.mediaPreviews.map((media, index) => (
                      <div key={media.url} className="relative rounded-xl overflow-hidden border border-black/[0.08] group">
                        <img src={media.url} alt={`Portfolio ${index + 1}`} className="w-full aspect-square object-cover" />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-xs text-white flex items-center justify-between">
                          <button type="button" className="underline" onClick={() => setPrimaryMedia(index)}>
                            {media.isPrimary ? "Primary" : "Set primary"}
                          </button>
                          <button type="button" className="underline" onClick={() => removeMedia(index)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Buyer requirements" description="Ask for the exact assets you need to start immediately.">
                <StringListEditor
                  values={state.requirements}
                  placeholder="e.g., Brand guidelines, references, target audience"
                  onChange={(values) => updateState({ requirements: values })}
                />
              </SectionCard>

              <SectionCard title="FAQs" description="Reduce back-and-forth by answering common concerns upfront.">
                <FaqEditor
                  values={state.faqs}
                  onChange={(faqs) => updateState({ faqs })}
                />
              </SectionCard>

              <SectionCard title="Search tags" description="Help buyers discover your service in marketplace and studio.">
                <StringListEditor
                  values={state.keywords}
                  placeholder="e.g., landing page, figma, conversion optimization"
                  onChange={(values) => updateState({ keywords: values })}
                />
              </SectionCard>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-6">
              <SectionCard title="Ready to publish" description="Quick quality check before listing goes live.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReviewItem label="Category" value={selectedCategory?.name || "Not set"} />
                  <ReviewItem label="Specialization" value={state.subcategory || "Not set"} />
                  <ReviewItem label="Title" value={state.title || "Not set"} />
                  <ReviewItem label="Media" value={`${state.mediaPreviews.length} files`} />
                  <ReviewItem label="Packages" value={`${state.packages.length} tier(s)`} />
                  <ReviewItem label="Requirements" value={`${state.requirements.length} questions`} />
                </div>

                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-primary/5 via-pink-vivid/5 to-orange-warm/5 border border-purple-primary/10">
                  <p className="text-sm font-body text-ink">
                    Unique PinkQuill advantage: every commission listing highlights the creator story, process clarity, and transparent package scope. Buyers see exactly what they get before they hire.
                  </p>
                </div>
              </SectionCard>
            </section>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1 || creating}
            className="px-5 py-3 rounded-full text-sm font-ui font-semibold text-ink bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={creating}
              className="px-7 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={publishService}
              disabled={creating}
              className="px-7 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? "Publishing..." : "Publish Service"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRail({ currentStep }: { currentStep: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const isActive = currentStep === step;
        const isCompleted = currentStep > step;

        return (
          <div
            key={label}
            className={`rounded-xl border px-3 py-3 transition-all ${
              isActive
                ? "border-pink-vivid bg-pink-50/60"
                : isCompleted
                ? "border-purple-primary/30 bg-purple-50/40"
                : "border-black/[0.08] bg-white"
            }`}
          >
            <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">Step {step}</p>
            <p className="text-sm font-ui font-semibold text-ink">{label}</p>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="text-sm font-body text-muted mt-1 mb-5">{description}</p>
      {children}
    </div>
  );
}

function FieldLabel({ text, required = false }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-ui font-semibold text-ink">
      {text}
      {required && <span className="text-pink-vivid"> *</span>}
    </label>
  );
}

function PackageEditor({
  index,
  pkg,
  canRemove,
  onRemove,
  onChange,
}: {
  index: number;
  pkg: CommissionPackageFormState;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (updates: Partial<CommissionPackageFormState>) => void;
}) {
  return (
    <div className="rounded-xl border border-black/[0.08] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-ui font-semibold text-ink">Package {index + 1}</p>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-ui text-red-500 hover:text-red-600">
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          value={pkg.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Package name"
          className="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
        />
        <input
          type="number"
          min={5}
          step={1}
          value={pkg.price ?? ""}
          onChange={(event) => onChange({ price: event.target.value ? Number(event.target.value) : null })}
          placeholder="Price (USD)"
          className="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
        />
      </div>

      <textarea
        rows={3}
        value={pkg.description}
        onChange={(event) => onChange({ description: event.target.value })}
        placeholder="Describe scope and deliverables."
        className="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="number"
          min={1}
          value={pkg.deliveryDays}
          onChange={(event) => onChange({ deliveryDays: Math.max(1, Number(event.target.value || 1)) })}
          placeholder="Delivery days"
          className="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
        />
        <input
          type="number"
          min={0}
          value={pkg.revisions}
          onChange={(event) => onChange({ revisions: Math.max(0, Number(event.target.value || 0)) })}
          placeholder="Revisions"
          className="w-full px-3 py-2.5 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
        />
      </div>

      <StringListEditor
        values={pkg.features}
        placeholder="e.g., 3 design concepts, source file, commercial use"
        onChange={(features) => onChange({ features })}
      />
    </div>
  );
}

function StringListEditor({
  values,
  placeholder,
  onChange,
}: {
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  const addValue = () => {
    onChange([...values, ""]);
  };

  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={`${index}-${value}`} className="flex items-center gap-2">
          <input
            value={value}
            onChange={(event) => updateValue(index, event.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
          />
          <button type="button" onClick={() => removeValue(index)} className="text-xs font-ui text-red-500">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addValue} className="text-xs font-ui font-semibold text-purple-primary">
        + Add line
      </button>
    </div>
  );
}

function FaqEditor({
  values,
  onChange,
}: {
  values: Array<{ question: string; answer: string }>;
  onChange: (values: Array<{ question: string; answer: string }>) => void;
}) {
  const updateItem = (index: number, updates: { question?: string; answer?: string }) => {
    onChange(values.map((item, idx) => (idx === index ? { ...item, ...updates } : item)));
  };

  const removeItem = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  const addItem = () => {
    onChange([...values, { question: "", answer: "" }]);
  };

  return (
    <div className="space-y-3">
      {values.map((item, index) => (
        <div key={index} className="rounded-xl border border-black/[0.08] p-3 space-y-2">
          <input
            value={item.question}
            onChange={(event) => updateItem(index, { question: event.target.value })}
            placeholder="Question"
            className="w-full px-3 py-2 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
          />
          <textarea
            rows={2}
            value={item.answer}
            onChange={(event) => updateItem(index, { answer: event.target.value })}
            placeholder="Answer"
            className="w-full px-3 py-2 rounded-lg border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
          />
          <button type="button" onClick={() => removeItem(index)} className="text-xs font-ui text-red-500">
            Remove FAQ
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-xs font-ui font-semibold text-purple-primary">
        + Add FAQ
      </button>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/[0.08] px-3 py-2.5">
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-ui font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}
