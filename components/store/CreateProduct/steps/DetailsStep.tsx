"use client";

import { useMemo } from "react";
import { ProductDelivery, ProductWizardState } from "@/lib/types/store";
import {
  CategoryConfig,
  CategoryField,
  getFieldsForDelivery,
  shouldShowField,
  getSubcategoryLabel,
} from "@/lib/store/categories";
import TextField from "../fields/TextField";
import TextareaField from "../fields/TextareaField";
import SelectField from "../fields/SelectField";
import MultiSelectField from "../fields/MultiSelectField";
import NumberField from "../fields/NumberField";
import BooleanField from "../fields/BooleanField";
import DimensionsField from "../fields/DimensionsField";
import TagInput from "../fields/TagInput";

interface DetailsStepProps {
  deliveryType: ProductDelivery;
  category: string;
  subcategory: string | null;
  categoryConfig: CategoryConfig;
  wizardState: ProductWizardState;
  updateState: (updates: Partial<ProductWizardState>) => void;
}

// Computed once at module load so the dropdown options aren't rebuilt on
// every render of the step. Refreshes on full page reload, which is fine
// — a 100-year window doesn't need sub-page-load precision.
const YEAR_OPTIONS = Array.from(
  { length: 100 },
  (_, i) => new Date().getFullYear() - i
);

function PwywControls({
  min,
  price,
  onChange,
}: {
  min: number | null;
  price: number | null;
  onChange: (next: number | null) => void;
}) {
  const enabled = min !== null;
  const priceValue = price ?? 0;
  return (
    <div className="mt-3 space-y-2">
      <label className="inline-flex items-center gap-2 cursor-pointer group">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? 0 : null)}
          className="sr-only"
        />
        <div
          className={`w-4 h-4 rounded flex items-center justify-center transition-all border-2 ${
            enabled
              ? "bg-gradient-to-r from-orange-warm to-pink-vivid border-transparent"
              : "border-gray-300 group-hover:border-pink-vivid/50"
          }`}
        >
          {enabled && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-xs font-ui text-muted">Let buyers name their own price</span>
      </label>

      {enabled && (
        <div className="pl-6 space-y-1">
          <label className="block text-xs font-ui text-muted">Minimum they must pay</label>
          <div className="relative w-40">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-warm/40 to-pink-vivid/40 p-[1px]">
              <div className="w-full h-full rounded-lg bg-surface" />
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-pink-vivid font-medium text-sm">$</span>
              <input
                type="number"
                min="0"
                max={priceValue}
                step="0.01"
                value={min ?? 0}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onChange(0);
                    return;
                  }
                  const parsed = parseFloat(raw);
                  if (!Number.isFinite(parsed)) return;
                  onChange(Math.max(0, parsed));
                }}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm bg-transparent outline-none font-body
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          {min === 0 && (
            <p className="text-[11px] font-body text-green-700">Buyers can take this for free.</p>
          )}
          {min !== null && min > priceValue && priceValue > 0 && (
            <p className="text-[11px] font-body text-red-600">Minimum cannot exceed the suggested price.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Section header component
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-display font-bold text-ink mb-6">
      {children}
    </h3>
  );
}

export default function DetailsStep({
  deliveryType,
  category,
  subcategory,
  categoryConfig,
  wizardState,
  updateState,
}: DetailsStepProps) {
  const effectiveDeliveryType = deliveryType === 'both' ? 'physical' : deliveryType;
  const fields = useMemo(
    () => getFieldsForDelivery(category, effectiveDeliveryType),
    [category, effectiveDeliveryType]
  );

  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, CategoryField[]> = {
      classification: [],
      presentation: [],
      details: [],
      shipping: [],
      pricing: [],
    };

    fields.forEach((field) => {
      if (groups[field.group]) {
        groups[field.group].push(field);
      }
    });

    return groups;
  }, [fields]);

  const updateAttribute = (key: string, value: unknown) => {
    updateState({
      attributes: {
        ...wizardState.attributes,
        [key]: value,
      },
    });
  };

  const isFieldVisible = (field: CategoryField): boolean => {
    const allValues = {
      ...wizardState.attributes,
      subcategory: wizardState.subcategory,
    };
    return shouldShowField(field, allValues);
  };

  const renderField = (field: CategoryField) => {
    if (!isFieldVisible(field)) return null;

    const value = wizardState.attributes[field.key];
    const onChange = (newValue: unknown) => updateAttribute(field.key, newValue);

    switch (field.type) {
      case "text":
        return <TextField key={field.key} field={field} value={(value as string) || ""} onChange={onChange} />;
      case "textarea":
        return <TextareaField key={field.key} field={field} value={(value as string) || ""} onChange={onChange} />;
      case "number":
      case "year":
        return <NumberField key={field.key} field={field} value={value as number | undefined} onChange={onChange} />;
      case "select":
        return <SelectField key={field.key} field={field} value={(value as string) || ""} onChange={onChange} />;
      case "multiselect":
        return <MultiSelectField key={field.key} field={field} value={(value as string[]) || []} onChange={onChange} />;
      case "boolean":
        return <BooleanField key={field.key} field={field} value={value as boolean} onChange={onChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-10">
      {/* Title Section */}
      <div>
        <label className="block text-sm font-ui font-semibold text-ink mb-3">
          Title <span className="text-pink-vivid">*</span>
        </label>
        {/* Gradient border wrapper */}
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
            <div className="w-full h-full rounded-xl bg-surface" />
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              value={wizardState.title}
              onChange={(e) => updateState({ title: e.target.value })}
              placeholder={`Name your ${subcategory ? getSubcategoryLabel(category, subcategory) : categoryConfig.name.toLowerCase()}`}
              className="w-full px-4 py-3.5 pr-12 rounded-xl
                bg-transparent
                outline-none transition-all duration-300
                font-body text-ink placeholder:text-gray-400"
            />
            <div className="absolute right-4 text-orange-warm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Year */}
      <div>
        <label className="block text-sm font-ui font-semibold text-ink mb-3">
          Year created
        </label>
        <div className="relative w-48">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
            <div className="w-full h-full rounded-xl bg-surface" />
          </div>
          <select
            value={wizardState.yearCreated || ""}
            onChange={(e) => updateState({ yearCreated: e.target.value ? parseInt(e.target.value) : null })}
            className="relative w-full px-4 py-3.5 pr-10 rounded-xl appearance-none cursor-pointer
              bg-transparent
              outline-none transition-all duration-300
              font-body text-ink"
          >
            <option value="">Select year</option>
            {YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-warm pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Classification Section */}
      {fieldsByGroup.classification.length > 0 && (
        <div>
          <SectionHeader>Classification:</SectionHeader>
          <div className="space-y-6">
            {fieldsByGroup.classification.map(renderField)}
          </div>
        </div>
      )}

      {/* Presentation Section (physical only) */}
      {deliveryType !== "digital" && fieldsByGroup.presentation.length > 0 && (
        <div>
          <SectionHeader>Presentation:</SectionHeader>
          <div className="space-y-6">
            {fieldsByGroup.presentation.map(renderField)}
          </div>
        </div>
      )}

      {/* Dimensions Section (physical only) */}
      {deliveryType !== "digital" && (
        <div>
          <SectionHeader>Dimensions:</SectionHeader>
          <DimensionsField
            shipping={wizardState.shipping}
            onChange={(shipping) => updateState({ shipping })}
          />
        </div>
      )}

      {/* Pricing Section */}
      <div className="pt-6 border-t border-gray-100">
        <SectionHeader>Pricing:</SectionHeader>
        <PricingSection
          deliveryType={deliveryType}
          categoryConfig={categoryConfig}
          wizardState={wizardState}
          updateState={updateState}
        />
      </div>

      {/* Shipping Section (physical only) */}
      {deliveryType !== "digital" && (
        <div className="pt-6 border-t border-gray-100">
          <SectionHeader>Shipping:</SectionHeader>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-ui font-semibold text-ink mb-3">
                Shipping services
              </label>
              <TagInput
                values={wizardState.shipping.shipping_services || []}
                onChange={(shipping_services) =>
                  updateState({
                    shipping: { ...wizardState.shipping, shipping_services },
                  })
                }
                placeholder="DHL, FedEx, UPS…"
                helperText="Press Enter or comma to add"
                max={10}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-3">
                  Shipping locations
                </label>
                <TagInput
                  values={wizardState.shipping.shipping_locations || []}
                  onChange={(shipping_locations) =>
                    updateState({
                      shipping: { ...wizardState.shipping, shipping_locations },
                    })
                  }
                  placeholder="United States, Canada, International…"
                  helperText="Press Enter or comma to add"
                  max={20}
                />
              </div>

              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-3">
                  Packaging
                </label>
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-surface" />
                  </div>
                  <select
                    value={wizardState.shipping.packaging || ""}
                    onChange={(e) =>
                      updateState({
                        shipping: {
                          ...wizardState.shipping,
                          packaging: e.target.value || undefined,
                        },
                      })
                    }
                    className="relative w-full px-4 py-3 rounded-xl
                      bg-transparent
                      outline-none transition-all duration-300
                      font-body text-ink appearance-none"
                  >
                    <option value="">Select packaging</option>
                    <option value="box">Box</option>
                    <option value="wood_crate">Wood crate</option>
                    <option value="tube">Tube</option>
                    <option value="envelope">Envelope</option>
                    <option value="padded_envelope">Padded envelope</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-3">
                  Shipping price (USD)
                </label>
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-surface" />
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-pink-vivid font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wizardState.shipping.shipping_cost ?? ""}
                      onChange={(e) =>
                        updateState({
                          shipping: {
                            ...wizardState.shipping,
                            shipping_cost: e.target.value ? parseFloat(e.target.value) : 0,
                          },
                        })
                      }
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 rounded-xl
                        bg-transparent
                        outline-none transition-all duration-300 font-body
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-3">
                  Processing days
                </label>
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-surface" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={wizardState.shipping.processing_days ?? ""}
                    onChange={(e) =>
                      updateState({
                        shipping: {
                          ...wizardState.shipping,
                          processing_days: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        },
                      })
                    }
                    placeholder="3"
                    className="relative w-full px-4 py-3 rounded-xl
                      bg-transparent
                      outline-none transition-all duration-300
                      font-body text-ink"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Section */}
      {fieldsByGroup.details.length > 0 && (
        <div className="pt-6 border-t border-gray-100">
          <SectionHeader>Additional Details:</SectionHeader>
          <div className="space-y-6">
            {fieldsByGroup.details.map(renderField)}
          </div>
        </div>
      )}

      {/* Description Section */}
      <div className="pt-6 border-t border-gray-100">
        <SectionHeader>Description:</SectionHeader>
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
            <div className="w-full h-full rounded-xl bg-surface" />
          </div>
          <div className="relative">
            <textarea
              value={wizardState.description}
              onChange={(e) => updateState({ description: e.target.value })}
              placeholder="Tell buyers about your work..."
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3.5 rounded-xl resize-none
                bg-transparent
                outline-none transition-all duration-300
                font-body text-ink placeholder:text-gray-400"
            />
            <div className="absolute right-4 top-4 text-orange-warm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <p className={`text-xs font-ui ${wizardState.description.length > 1800 ? 'text-orange-warm' : 'text-muted'}`}>
            {wizardState.description.length} / 2000
          </p>
        </div>
      </div>

      {/* Keywords Section */}
      <div>
        <SectionHeader>Keywords:</SectionHeader>
        <TagInput
          values={wizardState.keywords}
          onChange={(keywords) => updateState({ keywords })}
          placeholder="Add keywords…"
          helperText="Press Enter or comma to add"
          max={10}
          lowercase
          chipPrefix="#"
        />
      </div>
    </div>
  );
}

// Pricing Section
function PricingSection({
  deliveryType,
  categoryConfig,
  wizardState,
  updateState,
}: {
  deliveryType: ProductDelivery;
  categoryConfig: CategoryConfig;
  wizardState: ProductWizardState;
  updateState: (updates: Partial<ProductWizardState>) => void;
}) {
  const { pricingOptions } = categoryConfig;

  return (
    <div className="space-y-8">
      {/* Original piece */}
      {deliveryType !== "digital" && pricingOptions.original && (
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={wizardState.sellOriginal}
              onChange={(e) => updateState({ sellOriginal: e.target.checked })}
              className="sr-only"
            />
            <div className={`
              w-5 h-5 rounded flex items-center justify-center transition-all border-2
              ${wizardState.sellOriginal
                ? "bg-gradient-to-r from-orange-warm to-pink-vivid border-transparent"
                : "border-gray-300 group-hover:border-pink-vivid/50"
              }
            `}>
              {wizardState.sellOriginal && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="font-ui text-sm text-ink">Sell original piece</span>
          </label>

          {wizardState.sellOriginal && (
            <div className="pl-8">
              <label className="block text-sm font-ui text-muted mb-2">
                {wizardState.originalMin !== null ? "Suggested price" : "Price"}
              </label>
              <div className="relative w-48">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                  <div className="w-full h-full rounded-xl bg-surface" />
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-pink-vivid font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={wizardState.originalPrice || ""}
                    onChange={(e) => updateState({ originalPrice: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl
                      bg-transparent
                      outline-none transition-all duration-300 font-body
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <PwywControls
                min={wizardState.originalMin}
                price={wizardState.originalPrice}
                onChange={(next) => updateState({ originalMin: next })}
              />
            </div>
          )}
        </div>
      )}

      {/* Reproductions */}
      {pricingOptions.reproduction && (
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={wizardState.hasReproductions}
              onChange={(e) => updateState({ hasReproductions: e.target.checked })}
              className="sr-only"
            />
            <div className={`
              w-5 h-5 rounded flex items-center justify-center transition-all border-2
              ${wizardState.hasReproductions
                ? "bg-gradient-to-r from-orange-warm to-pink-vivid border-transparent"
                : "border-gray-300 group-hover:border-pink-vivid/50"
              }
            `}>
              {wizardState.hasReproductions && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="font-ui text-sm text-ink">Offer reproductions</span>
          </label>

          {wizardState.hasReproductions && (
            <div className="pl-8 space-y-4">
              <MultiSelectField
                field={{
                  key: "reproductionTypes",
                  label: "Type",
                  type: "multiselect",
                  group: "pricing",
                  options: pricingOptions.reproduction.types,
                }}
                value={wizardState.reproductions.map((r) => r.type)}
                onChange={(types) => {
                  const newReproductions = (types as string[]).map((type) => {
                    const existing = wizardState.reproductions.find((r) => r.type === type);
                    return existing || { type, price: 0, min: null };
                  });
                  updateState({ reproductions: newReproductions });
                }}
              />

              {wizardState.reproductions.map((reproduction, index) => (
                <div key={reproduction.type}>
                  <label className="block text-sm font-ui text-muted mb-2">
                    {pricingOptions.reproduction!.types.find((t) => t.value === reproduction.type)?.label}{" "}
                    {reproduction.min !== null ? "suggested price" : "price"}
                  </label>
                  <div className="relative w-48">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                      <div className="w-full h-full rounded-xl bg-surface" />
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-pink-vivid font-medium">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={reproduction.price || ""}
                        onChange={(e) => {
                          const newReproductions = [...wizardState.reproductions];
                          newReproductions[index] = { ...reproduction, price: parseFloat(e.target.value) || 0 };
                          updateState({ reproductions: newReproductions });
                        }}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-3 rounded-xl
                          bg-transparent
                          outline-none transition-all duration-300 font-body
                          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <PwywControls
                    min={reproduction.min}
                    price={reproduction.price}
                    onChange={(next) => {
                      const newReproductions = [...wizardState.reproductions];
                      newReproductions[index] = { ...reproduction, min: next };
                      updateState({ reproductions: newReproductions });
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Digital download */}
      {pricingOptions.digital && (deliveryType === "digital" || deliveryType === "both") && (
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={wizardState.hasDigitalDownload}
              onChange={(e) => updateState({ hasDigitalDownload: e.target.checked })}
              className="sr-only"
            />
            <div className={`
              w-5 h-5 rounded flex items-center justify-center transition-all border-2
              ${wizardState.hasDigitalDownload
                ? "bg-gradient-to-r from-orange-warm to-pink-vivid border-transparent"
                : "border-gray-300 group-hover:border-pink-vivid/50"
              }
            `}>
              {wizardState.hasDigitalDownload && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="font-ui text-sm text-ink">Digital download</span>
          </label>

          {wizardState.hasDigitalDownload && (
            <div className="pl-8 space-y-4">
              <SelectField
                field={{
                  key: "digitalFormat",
                  label: "Format",
                  type: "select",
                  group: "pricing",
                  options: pricingOptions.digital.formats,
                }}
                value={wizardState.digitalFormat || ""}
                onChange={(value) => updateState({ digitalFormat: value as string })}
              />

              <div>
                <label className="block text-sm font-ui text-muted mb-2">
                  {wizardState.digitalMin !== null ? "Suggested price" : "Price"}
                </label>
                <div className="relative w-48">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-surface" />
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-pink-vivid font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wizardState.digitalPrice || ""}
                      onChange={(e) => updateState({ digitalPrice: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 rounded-xl
                        bg-transparent
                        outline-none transition-all duration-300 font-body
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <PwywControls
                  min={wizardState.digitalMin}
                  price={wizardState.digitalPrice}
                  onChange={(next) => updateState({ digitalMin: next })}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

