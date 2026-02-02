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
        <label className="block text-sm font-ui font-medium text-ink mb-3">
          Title <span className="text-pink-vivid">*</span>
        </label>
        <input
          type="text"
          value={wizardState.title}
          onChange={(e) => updateState({ title: e.target.value })}
          placeholder={`Name your ${subcategory ? getSubcategoryLabel(category, subcategory) : categoryConfig.name.toLowerCase()}`}
          className="w-full px-5 py-4 rounded-2xl
            bg-white/50 ring-1 ring-gray-200/50
            focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
            outline-none transition-all duration-300
            font-body text-ink placeholder:text-gray-400"
        />
      </div>

      {/* Year */}
      <div>
        <label className="block text-sm font-ui font-medium text-ink mb-3">
          Year created
        </label>
        <div className="relative w-48">
          <select
            value={wizardState.yearCreated || ""}
            onChange={(e) => updateState({ yearCreated: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-5 py-4 rounded-2xl appearance-none cursor-pointer
              bg-white/50 ring-1 ring-gray-200/50
              focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
              outline-none transition-all duration-300
              font-body text-ink"
          >
            <option value="">Select year</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Classification fields */}
      {fieldsByGroup.classification.length > 0 && (
        <div className="space-y-6">
          {fieldsByGroup.classification.map(renderField)}
        </div>
      )}

      {/* Presentation fields (physical only) */}
      {deliveryType !== "digital" && fieldsByGroup.presentation.length > 0 && (
        <div className="space-y-6">
          {fieldsByGroup.presentation.map(renderField)}
        </div>
      )}

      {/* Dimensions (physical only) */}
      {deliveryType !== "digital" && (
        <div>
          <h3 className="text-sm font-ui font-medium text-ink mb-4">Dimensions</h3>
          <DimensionsField
            shipping={wizardState.shipping}
            onChange={(shipping) => updateState({ shipping })}
          />
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-100/80" />

      {/* Pricing */}
      <div>
        <h3 className="text-sm font-ui font-medium text-ink mb-6">Pricing</h3>
        <PricingSection
          deliveryType={deliveryType}
          categoryConfig={categoryConfig}
          wizardState={wizardState}
          updateState={updateState}
        />
      </div>

      {/* Shipping (physical only) */}
      {deliveryType !== "digital" && (
        <>
          <div className="border-t border-gray-100/80" />
          <div>
            <h3 className="text-sm font-ui font-medium text-ink mb-6">Shipping</h3>
            <div>
              <label className="block text-sm font-ui font-medium text-ink mb-3">
                Shipping services
              </label>
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
                className="w-full px-5 py-4 rounded-2xl
                  bg-white/50 ring-1 ring-gray-200/50
                  focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
                  outline-none transition-all duration-300
                  font-body text-ink placeholder:text-gray-400"
              />
              <p className="text-xs text-muted mt-2">Separate with commas</p>
            </div>
          </div>
        </>
      )}

      {/* Details fields */}
      {fieldsByGroup.details.length > 0 && (
        <>
          <div className="border-t border-gray-100/80" />
          <div className="space-y-6">
            {fieldsByGroup.details.map(renderField)}
          </div>
        </>
      )}

      {/* Description */}
      <div className="border-t border-gray-100/80 pt-10">
        <label className="block text-sm font-ui font-medium text-ink mb-3">
          Description
        </label>
        <textarea
          value={wizardState.description}
          onChange={(e) => updateState({ description: e.target.value })}
          placeholder="Tell buyers about your work..."
          rows={4}
          maxLength={2000}
          className="w-full px-5 py-4 rounded-2xl resize-none
            bg-white/50 ring-1 ring-gray-200/50
            focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
            outline-none transition-all duration-300
            font-body text-ink placeholder:text-gray-400"
        />
        <div className="flex justify-end mt-2">
          <p className={`text-xs font-ui ${wizardState.description.length > 1800 ? 'text-orange-warm' : 'text-muted'}`}>
            {wizardState.description.length} / 2000
          </p>
        </div>
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm font-ui font-medium text-ink mb-3">
          Keywords
        </label>
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
              w-5 h-5 rounded-md flex items-center justify-center transition-all
              ${wizardState.sellOriginal
                ? "bg-gradient-to-br from-purple-primary to-pink-vivid"
                : "ring-2 ring-gray-300 group-hover:ring-purple-primary/50"
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wizardState.originalPrice || ""}
                  onChange={(e) => updateState({ originalPrice: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 rounded-xl
                    bg-white/50 ring-1 ring-gray-200/50
                    focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
                    outline-none transition-all duration-300 font-body"
                />
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
              w-5 h-5 rounded-md flex items-center justify-center transition-all
              ${wizardState.hasReproductions
                ? "bg-gradient-to-br from-purple-primary to-pink-vivid"
                : "ring-2 ring-gray-300 group-hover:ring-purple-primary/50"
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary font-medium">$</span>
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
                        bg-white/50 ring-1 ring-gray-200/50
                        focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
                        outline-none transition-all duration-300 font-body"
                    />
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
              w-5 h-5 rounded-md flex items-center justify-center transition-all
              ${wizardState.hasDigitalDownload
                ? "bg-gradient-to-br from-purple-primary to-pink-vivid"
                : "ring-2 ring-gray-300 group-hover:ring-purple-primary/50"
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={wizardState.digitalPrice || ""}
                    onChange={(e) => updateState({ digitalPrice: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl
                      bg-white/50 ring-1 ring-gray-200/50
                      focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
                      outline-none transition-all duration-300 font-body"
                  />
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
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addKeyword}
        placeholder="Add keywords..."
        disabled={keywords.length >= 10}
        className="w-full px-5 py-4 rounded-2xl
          bg-white/50 ring-1 ring-gray-200/50
          focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
          outline-none transition-all duration-300
          font-body text-ink placeholder:text-gray-400
          disabled:bg-gray-50 disabled:opacity-60"
      />
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
                bg-purple-primary/5 rounded-full
                text-sm font-ui text-purple-primary"
            >
              #{keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="p-0.5 hover:bg-purple-primary/10 rounded-full transition-colors"
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
