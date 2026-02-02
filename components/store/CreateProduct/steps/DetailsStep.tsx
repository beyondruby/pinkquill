"use client";

import { useState, useMemo } from "react";
import { ProductDelivery, ProductWizardState, ProductAttributes } from "@/lib/types/store";
import {
  CategoryConfig,
  CategoryField,
  getFieldsForDelivery,
  shouldShowField,
  getSubcategoryLabel,
  getCategoryIcon,
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
  // Get fields for current delivery type
  const effectiveDeliveryType = deliveryType === 'both' ? 'physical' : deliveryType;
  const fields = useMemo(
    () => getFieldsForDelivery(category, effectiveDeliveryType),
    [category, effectiveDeliveryType]
  );

  // Group fields by their group property
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

  // Update an attribute value
  const updateAttribute = (key: string, value: unknown) => {
    updateState({
      attributes: {
        ...wizardState.attributes,
        [key]: value,
      },
    });
  };

  // Check if field should be shown
  const isFieldVisible = (field: CategoryField): boolean => {
    const allValues = {
      ...wizardState.attributes,
      subcategory: wizardState.subcategory,
    };
    return shouldShowField(field, allValues);
  };

  // Render a field based on its type
  const renderField = (field: CategoryField) => {
    if (!isFieldVisible(field)) return null;

    const value = wizardState.attributes[field.key];
    const onChange = (newValue: unknown) => updateAttribute(field.key, newValue);

    switch (field.type) {
      case "text":
        return (
          <TextField
            key={field.key}
            field={field}
            value={(value as string) || ""}
            onChange={onChange}
          />
        );
      case "textarea":
        return (
          <TextareaField
            key={field.key}
            field={field}
            value={(value as string) || ""}
            onChange={onChange}
          />
        );
      case "number":
      case "year":
        return (
          <NumberField
            key={field.key}
            field={field}
            value={value as number | undefined}
            onChange={onChange}
          />
        );
      case "select":
        return (
          <SelectField
            key={field.key}
            field={field}
            value={(value as string) || ""}
            onChange={onChange}
          />
        );
      case "multiselect":
        return (
          <MultiSelectField
            key={field.key}
            field={field}
            value={(value as string[]) || []}
            onChange={onChange}
          />
        );
      case "boolean":
        return (
          <BooleanField
            key={field.key}
            field={field}
            value={value as boolean}
            onChange={onChange}
          />
        );
      default:
        return null;
    }
  };

  // Get years for year selector
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div className="py-6">
      {/* Header with category */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-primary to-pink-vivid
          flex items-center justify-center shadow-lg shadow-purple-primary/20 text-white">
          {getCategoryIcon(categoryConfig.icon)}
        </div>
        <div>
          <p className="text-xs text-muted font-ui uppercase tracking-wider">Describe your</p>
          <h2 className="text-2xl font-display font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
            {subcategory
              ? getSubcategoryLabel(category, subcategory)
              : categoryConfig.name}
          </h2>
        </div>
      </div>

      {/* Basic Info */}
      <GlassSection>
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-ui font-medium text-ink mb-2">
              Title <span className="text-pink-vivid">*</span>
            </label>
            <input
              type="text"
              value={wizardState.title}
              onChange={(e) => updateState({ title: e.target.value })}
              placeholder={`${subcategory ? getSubcategoryLabel(category, subcategory) : categoryConfig.name} Title`}
              className="w-full px-5 py-4 rounded-2xl
                bg-white/60 backdrop-blur-sm border border-gray-200/50
                focus:border-purple-primary/40 focus:bg-white focus:shadow-lg focus:shadow-purple-primary/5
                outline-none transition-all duration-300
                font-body text-ink placeholder:text-gray-400"
            />
          </div>

          {/* Year of creation */}
          <div>
            <label className="block text-sm font-ui font-medium text-ink mb-2">
              Year of creation
            </label>
            <div className="relative w-56">
              <select
                value={wizardState.yearCreated || ""}
                onChange={(e) =>
                  updateState({ yearCreated: e.target.value ? parseInt(e.target.value) : null })
                }
                className="w-full px-5 py-4 rounded-2xl appearance-none cursor-pointer
                  bg-white/60 backdrop-blur-sm border border-gray-200/50
                  focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
                  outline-none transition-all duration-300
                  font-body text-ink pr-12"
              >
                <option value="">Choose the year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </GlassSection>

      {/* Classification */}
      {fieldsByGroup.classification.length > 0 && (
        <FieldSection title="Classification" icon="tag">
          {fieldsByGroup.classification.map(renderField)}
        </FieldSection>
      )}

      {/* Presentation (physical only) */}
      {deliveryType !== "digital" && fieldsByGroup.presentation.length > 0 && (
        <FieldSection title="Presentation" icon="sparkles">
          {fieldsByGroup.presentation.map(renderField)}
        </FieldSection>
      )}

      {/* Dimensions (physical only) */}
      {deliveryType !== "digital" && (
        <FieldSection title="Dimensions" icon="ruler" subtitle="Without framing">
          <DimensionsField
            shipping={wizardState.shipping}
            onChange={(shipping) => updateState({ shipping })}
          />
        </FieldSection>
      )}

      {/* Pricing Section */}
      <FieldSection title="Pricing" icon="currency">
        <PricingSection
          deliveryType={deliveryType}
          categoryConfig={categoryConfig}
          wizardState={wizardState}
          updateState={updateState}
        />
      </FieldSection>

      {/* Shipping (physical only) */}
      {deliveryType !== "digital" && (
        <FieldSection title="Shipping" icon="truck">
          <ShippingSection
            wizardState={wizardState}
            updateState={updateState}
            fields={fieldsByGroup.shipping}
            renderField={renderField}
          />
        </FieldSection>
      )}

      {/* Details (styles, themes, etc.) */}
      {fieldsByGroup.details.length > 0 && (
        <FieldSection title="Additional Details" icon="info">
          {fieldsByGroup.details.map(renderField)}
        </FieldSection>
      )}

      {/* Description */}
      <FieldSection title="Description" icon="text">
        <div>
          <textarea
            value={wizardState.description}
            onChange={(e) => updateState({ description: e.target.value })}
            placeholder={`Describe your ${subcategory ? getSubcategoryLabel(category, subcategory) : categoryConfig.name}...`}
            rows={5}
            maxLength={2000}
            className="w-full px-5 py-4 rounded-2xl resize-none
              bg-white/60 backdrop-blur-sm border border-gray-200/50
              focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
              outline-none transition-all duration-300
              font-body text-ink placeholder:text-gray-400"
          />
          <div className="flex justify-between items-center mt-3 px-1">
            <p className="text-xs text-muted font-body">Tell buyers what makes this special</p>
            <p className={`text-xs font-ui font-medium ${wizardState.description.length > 1800 ? 'text-orange-warm' : 'text-muted'}`}>
              {wizardState.description.length} / 2000
            </p>
          </div>
        </div>
      </FieldSection>

      {/* Keywords */}
      <FieldSection title="Keywords" icon="hashtag">
        <KeywordsInput
          keywords={wizardState.keywords}
          onChange={(keywords) => updateState({ keywords })}
        />
      </FieldSection>
    </div>
  );
}

// Glass Section (for basic info)
function GlassSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-purple-primary/5 via-pink-vivid/3 to-transparent border border-purple-primary/10">
      {children}
    </div>
  );
}

// Section Icon Component
function SectionIcon({ icon }: { icon: string }) {
  const className = "w-4 h-4";

  switch (icon) {
    case "tag":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case "ruler":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    case "currency":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "truck":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      );
    case "info":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "text":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h12" />
        </svg>
      );
    case "hashtag":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      );
    default:
      return null;
  }
}

// Field Section Component
function FieldSection({
  title,
  icon,
  subtitle,
  children,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center text-purple-primary">
          <SectionIcon icon={icon} />
        </div>
        <div>
          <h3 className="text-base font-display font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-5 pl-11">{children}</div>
    </section>
  );
}

// Pricing Section Component
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
    <div className="space-y-6">
      {/* Original piece option (for physical with original support) */}
      {deliveryType !== "digital" && pricingOptions.original && (
        <div className="space-y-4">
          <BooleanField
            field={{
              key: "sellOriginal",
              label: "Sell original piece",
              type: "boolean",
              group: "pricing",
              helpText: "All original pieces must include signature and certificate of authenticity.",
            }}
            value={wizardState.sellOriginal}
            onChange={(value) => updateState({ sellOriginal: value as boolean })}
          />

          {wizardState.sellOriginal && (
            <div className="pl-6 border-l-2 border-purple-primary/20">
              <label className="block text-sm font-ui font-medium text-ink mb-2">
                Original piece price
              </label>
              <div className="relative w-56">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wizardState.originalPrice || ""}
                  onChange={(e) =>
                    updateState({
                      originalPrice: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl
                    bg-white/60 backdrop-blur-sm border border-gray-200/50
                    focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
                    outline-none transition-all duration-300 font-body"
                />
              </div>
              <p className="text-xs text-muted mt-2">Without shipping</p>
            </div>
          )}
        </div>
      )}

      {/* Reproduction option */}
      {pricingOptions.reproduction && (
        <div className="space-y-4">
          <BooleanField
            field={{
              key: "hasReproductions",
              label: "Reproduction available",
              type: "boolean",
              group: "pricing",
            }}
            value={wizardState.hasReproductions}
            onChange={(value) => updateState({ hasReproductions: value as boolean })}
          />

          {wizardState.hasReproductions && (
            <div className="space-y-4 pl-6 border-l-2 border-purple-primary/20">
              {/* Reproduction type selection */}
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

              {/* Prices for each reproduction type */}
              {wizardState.reproductions.map((reproduction, index) => (
                <div key={reproduction.type}>
                  <label className="block text-sm font-ui font-medium text-ink mb-2">
                    {pricingOptions.reproduction!.types.find((t) => t.value === reproduction.type)
                      ?.label || reproduction.type}{" "}
                    price
                  </label>
                  <div className="relative w-56">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={reproduction.price || ""}
                      onChange={(e) => {
                        const newReproductions = [...wizardState.reproductions];
                        newReproductions[index] = {
                          ...reproduction,
                          price: parseFloat(e.target.value) || 0,
                        };
                        updateState({ reproductions: newReproductions });
                      }}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl
                        bg-white/60 backdrop-blur-sm border border-gray-200/50
                        focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
                        outline-none transition-all duration-300 font-body"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Digital download option */}
      {pricingOptions.digital && (deliveryType === "digital" || deliveryType === "both") && (
        <div className="space-y-4">
          <BooleanField
            field={{
              key: "hasDigitalDownload",
              label: "Digital download available",
              type: "boolean",
              group: "pricing",
            }}
            value={wizardState.hasDigitalDownload}
            onChange={(value) => updateState({ hasDigitalDownload: value as boolean })}
          />

          {wizardState.hasDigitalDownload && (
            <div className="space-y-4 pl-6 border-l-2 border-purple-primary/20">
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
                <label className="block text-sm font-ui font-medium text-ink mb-2">
                  Digital download price
                </label>
                <div className="relative w-56">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={wizardState.digitalPrice || ""}
                    onChange={(e) =>
                      updateState({
                        digitalPrice: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl
                      bg-white/60 backdrop-blur-sm border border-gray-200/50
                      focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
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

// Shipping Section Component
function ShippingSection({
  wizardState,
  updateState,
  fields,
  renderField,
}: {
  wizardState: ProductWizardState;
  updateState: (updates: Partial<ProductWizardState>) => void;
  fields: CategoryField[];
  renderField: (field: CategoryField) => React.ReactNode;
}) {
  const updateShipping = (key: string, value: unknown) => {
    updateState({
      shipping: {
        ...wizardState.shipping,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* Shipping services */}
      <div>
        <label className="block text-sm font-ui font-medium text-ink mb-2">
          Shipping services
        </label>
        <input
          type="text"
          value={wizardState.shipping.shipping_services?.join(", ") || ""}
          onChange={(e) =>
            updateShipping(
              "shipping_services",
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
            )
          }
          placeholder="DHL, FedEx, UPS"
          className="w-full px-5 py-4 rounded-2xl
            bg-white/60 backdrop-blur-sm border border-gray-200/50
            focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
            outline-none transition-all duration-300
            font-body text-ink placeholder:text-gray-400"
        />
        <p className="text-xs text-muted mt-2">Separate multiple services with commas</p>
      </div>

      {/* Render other shipping fields from config */}
      {fields.filter((f) => f.key !== "shipping_services").map(renderField)}
    </div>
  );
}

// Keywords Input Component
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
        placeholder="Add keywords that describe your product"
        disabled={keywords.length >= 10}
        className="w-full px-5 py-4 rounded-2xl
          bg-white/60 backdrop-blur-sm border border-gray-200/50
          focus:border-purple-primary/40 focus:bg-white focus:shadow-lg
          outline-none transition-all duration-300
          font-body text-ink placeholder:text-gray-400
          disabled:bg-gray-50 disabled:opacity-60"
      />
      <div className="flex justify-between items-center mt-3 px-1">
        <p className="text-xs text-muted">Press Enter or comma to add</p>
        <p className={`text-xs font-ui font-medium ${keywords.length >= 8 ? 'text-orange-warm' : 'text-muted'}`}>
          {keywords.length} / 10
        </p>
      </div>

      {/* Keyword tags */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {keywords.map((keyword, index) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-2 px-4 py-2
                bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5
                border border-purple-primary/15 rounded-full
                text-sm font-ui font-medium text-purple-primary
                hover:shadow-md hover:border-purple-primary/25
                transition-all duration-300 group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-purple-primary/50">#</span>
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="p-0.5 hover:bg-purple-primary/10 rounded-full transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
