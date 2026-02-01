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
  // 'both' products show all fields (treat as physical for field filtering)
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
    <div className="py-4">
      {/* Header with category icon */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-primary to-pink-vivid
          flex items-center justify-center shadow-lg shadow-purple-primary/20 text-white">
          {getCategoryIcon(categoryConfig.icon)}
        </div>
        <div>
          <p className="text-xs text-muted font-ui uppercase tracking-wide">Describe your</p>
          <h2 className="text-xl font-display font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
            {subcategory
              ? getSubcategoryLabel(category, subcategory)
              : categoryConfig.name}
          </h2>
        </div>
      </div>

      {/* Basic Info */}
      <section className="mb-8 p-5 bg-gradient-to-br from-purple-50/30 to-pink-50/30 rounded-2xl border border-purple-100/30">
        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-ui font-medium text-ink mb-2">
              Title <span className="text-pink-vivid">*</span>
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary/60 group-focus-within:text-purple-primary transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <input
                type="text"
                value={wizardState.title}
                onChange={(e) => updateState({ title: e.target.value })}
                placeholder={`${subcategory ? getSubcategoryLabel(category, subcategory) : categoryConfig.name} Title`}
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white
                  focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                  transition-all font-body placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Year of creation */}
          <div>
            <label className="block text-sm font-ui font-medium text-ink mb-2">
              Year of creation
            </label>
            <div className="relative w-48">
              <select
                value={wizardState.yearCreated || ""}
                onChange={(e) =>
                  updateState({ yearCreated: e.target.value ? parseInt(e.target.value) : null })
                }
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-white
                  focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                  transition-all appearance-none cursor-pointer font-body pr-10"
              >
                <option value="">Choose the year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Classification */}
      {fieldsByGroup.classification.length > 0 && (
        <FieldSection title="Classification:">
          {fieldsByGroup.classification.map(renderField)}
        </FieldSection>
      )}

      {/* Presentation (physical only) */}
      {deliveryType !== "digital" && fieldsByGroup.presentation.length > 0 && (
        <FieldSection title="Presentation:">
          {fieldsByGroup.presentation.map(renderField)}
        </FieldSection>
      )}

      {/* Dimensions (physical only) */}
      {deliveryType !== "digital" && (
        <FieldSection title="Dimensions (without framing):">
          <DimensionsField
            shipping={wizardState.shipping}
            onChange={(shipping) => updateState({ shipping })}
          />
        </FieldSection>
      )}

      {/* Pricing Section */}
      <FieldSection title="Price:">
        <PricingSection
          deliveryType={deliveryType}
          categoryConfig={categoryConfig}
          wizardState={wizardState}
          updateState={updateState}
        />
      </FieldSection>

      {/* Shipping (physical only) */}
      {deliveryType !== "digital" && (
        <FieldSection title="Shipping:">
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
        <FieldSection title="Details:">
          {fieldsByGroup.details.map(renderField)}
        </FieldSection>
      )}

      {/* Description */}
      <FieldSection title="Description">
        <div>
          <div className="relative group">
            <span className="absolute left-4 top-4 text-purple-primary/60 group-focus-within:text-purple-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h12" />
              </svg>
            </span>
            <textarea
              value={wizardState.description}
              onChange={(e) => updateState({ description: e.target.value })}
              placeholder={`Describe Your ${subcategory ? getSubcategoryLabel(category, subcategory) : categoryConfig.name}...`}
              rows={5}
              maxLength={2000}
              className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white
                focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                transition-all resize-none font-body placeholder:text-gray-400"
            />
          </div>
          <div className="flex justify-between items-center mt-2 px-1">
            <p className="text-xs text-muted">Tell buyers what makes this special</p>
            <p className={`text-xs font-medium ${wizardState.description.length > 1800 ? 'text-orange-warm' : 'text-muted'}`}>
              {wizardState.description.length} / 2000
            </p>
          </div>
        </div>
      </FieldSection>

      {/* Keywords */}
      <FieldSection title="Keywords">
        <KeywordsInput
          keywords={wizardState.keywords}
          onChange={(keywords) => updateState({ keywords })}
        />
      </FieldSection>
    </div>
  );
}

// Field Section Component
function FieldSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-primary to-pink-vivid" />
        <h3 className="text-base font-display font-semibold text-ink">{title}</h3>
      </div>
      <div className="space-y-4 pl-4">{children}</div>
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
        <div className="space-y-3">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original piece Price without shipping
              </label>
              <div className="relative w-48">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </span>
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
                  className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
                    focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                    transition-all"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reproduction option */}
      {pricingOptions.reproduction && (
        <div className="space-y-3">
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
            <div className="space-y-4 pl-4 border-l-2 border-purple-100">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {pricingOptions.reproduction!.types.find((t) => t.value === reproduction.type)
                      ?.label || reproduction.type}{" "}
                    Price
                  </label>
                  <div className="relative w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </span>
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
                      className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
                        focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                        transition-all"
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
        <div className="space-y-3">
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
            <div className="space-y-4 pl-4 border-l-2 border-purple-100">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Digital download Price
                </label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </span>
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
                    className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
                      focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
                      transition-all"
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
    <div className="space-y-4">
      {/* Shipping services */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Shipping services (ex: DHL, FedEx)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-primary">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </span>
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
            className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl
              focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
              transition-all"
          />
        </div>
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
      <div className="relative group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-primary/60 group-focus-within:text-purple-primary transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addKeyword}
          placeholder="Add keywords that describe your product"
          disabled={keywords.length >= 10}
          className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl bg-white
            focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
            transition-all disabled:bg-gray-50 font-body placeholder:text-gray-400"
        />
      </div>
      <div className="flex justify-between items-center mt-2 px-1">
        <p className="text-xs text-muted">Press Enter or comma to add</p>
        <p className={`text-xs font-medium ${keywords.length >= 8 ? 'text-orange-warm' : 'text-muted'}`}>
          {keywords.length} / 10 keywords
        </p>
      </div>

      {/* Keyword tags */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {keywords.map((keyword, index) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1.5 px-3 py-1.5
                bg-gradient-to-r from-purple-50 to-pink-50
                border border-purple-100/50 rounded-full text-sm font-medium text-purple-primary
                hover:shadow-sm transition-all group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-purple-primary/60">#</span>
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                className="p-0.5 hover:bg-purple-100 rounded-full transition-colors ml-0.5"
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
