"use client";

import { useState, useMemo } from "react";
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

interface DetailsStepProps {
  deliveryType: ProductDelivery;
  category: string;
  subcategory: string | null;
  categoryConfig: CategoryConfig;
  wizardState: ProductWizardState;
  updateState: (updates: Partial<ProductWizardState>) => void;
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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

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
            <div className="w-full h-full rounded-xl bg-white" />
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
            <div className="w-full h-full rounded-xl bg-white" />
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
            {years.map((year) => (
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
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                  <div className="w-full h-full rounded-xl bg-white" />
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={wizardState.shipping.shipping_services?.join(", ") || ""}
                    onChange={(e) =>
                      updateState({
                        shipping: {
                          ...wizardState.shipping,
                          shipping_services: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                    placeholder="DHL, FedEx, UPS"
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
              <p className="text-xs text-muted mt-2">Separate with commas</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-3">
                  Shipping locations
                </label>
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-white" />
                  </div>
                  <input
                    type="text"
                    value={wizardState.shipping.shipping_locations?.join(", ") || ""}
                    onChange={(e) =>
                      updateState({
                        shipping: {
                          ...wizardState.shipping,
                          shipping_locations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                    placeholder="United States, Canada, International"
                    className="relative w-full px-4 py-3 rounded-xl
                      bg-transparent
                      outline-none transition-all duration-300
                      font-body text-ink placeholder:text-gray-400"
                  />
                </div>
                <p className="text-xs text-muted mt-2">Separate with commas</p>
              </div>

              <div>
                <label className="block text-sm font-ui font-semibold text-ink mb-3">
                  Packaging
                </label>
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-white" />
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
                    <div className="w-full h-full rounded-xl bg-white" />
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
                    <div className="w-full h-full rounded-xl bg-white" />
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
            <div className="w-full h-full rounded-xl bg-white" />
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
        <KeywordsInput
          keywords={wizardState.keywords}
          onChange={(keywords) => updateState({ keywords })}
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
              <div className="relative w-48">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                  <div className="w-full h-full rounded-xl bg-white" />
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
                    return existing || { type, price: 0 };
                  });
                  updateState({ reproductions: newReproductions });
                }}
              />

              {wizardState.reproductions.map((reproduction, index) => (
                <div key={reproduction.type}>
                  <label className="block text-sm font-ui text-muted mb-2">
                    {pricingOptions.reproduction!.types.find((t) => t.value === reproduction.type)?.label} price
                  </label>
                  <div className="relative w-48">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                      <div className="w-full h-full rounded-xl bg-white" />
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
                <label className="block text-sm font-ui text-muted mb-2">Price</label>
                <div className="relative w-48">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
                    <div className="w-full h-full rounded-xl bg-white" />
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Keywords Input
function KeywordsInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const addKeyword = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < 10) {
      onChange([...keywords, trimmed]);
      setInputValue("");
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div>
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
          <div className="w-full h-full rounded-xl bg-white" />
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addKeyword}
            placeholder="Add keywords..."
            disabled={keywords.length >= 10}
            className="w-full px-4 py-3.5 pr-12 rounded-xl
              bg-transparent
              outline-none transition-all duration-300
              font-body text-ink placeholder:text-gray-400
              disabled:opacity-60"
          />
          <div className="absolute right-4 text-orange-warm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <p className="text-xs text-muted">Press Enter to add</p>
        <p className={`text-xs font-ui ${keywords.length >= 8 ? 'text-orange-warm' : 'text-muted'}`}>
          {keywords.length} / 10
        </p>
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-2 px-3 py-1.5
                bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 rounded-full
                text-sm font-ui text-pink-vivid"
            >
              #{keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="p-0.5 hover:bg-pink-vivid/20 rounded-full transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
