"use client";

import { useMemo } from "react";
import { ProductDelivery, ProductWizardState } from "@/lib/types/store";
import { CategoryConfig, CategoryField, getFieldsForDelivery, getSubcategoryLabel, shouldShowField } from "@/lib/store/categories";
import { Section, INPUT, Label, Select, TagList } from "@/components/listing/form";
import TextField from "../fields/TextField";
import TextareaField from "../fields/TextareaField";
import SelectField from "../fields/SelectField";
import MultiSelectField from "../fields/MultiSelectField";
import NumberField from "../fields/NumberField";
import BooleanField from "../fields/BooleanField";

interface DetailsStepProps {
  deliveryType: ProductDelivery;
  category: string;
  subcategory: string | null;
  categoryConfig: CategoryConfig;
  wizardState: ProductWizardState;
  updateState: (updates: Partial<ProductWizardState>) => void;
}

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;

// Computed once at module load; a 100-year window doesn't need per-render precision.
const YEARS = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

export default function DetailsStep({ deliveryType, category, subcategory, categoryConfig, wizardState, updateState }: DetailsStepProps) {
  const effectiveDelivery = deliveryType === "both" ? "physical" : deliveryType;
  const fields = useMemo(() => getFieldsForDelivery(category, effectiveDelivery), [category, effectiveDelivery]);
  const groups = useMemo(() => {
    const g: Record<string, CategoryField[]> = { classification: [], presentation: [], details: [] };
    fields.forEach((f) => { if (g[f.group]) g[f.group].push(f); });
    return g;
  }, [fields]);

  const setAttr = (key: string, value: unknown) => updateState({ attributes: { ...wizardState.attributes, [key]: value } });
  const visible = (f: CategoryField) => shouldShowField(f, { ...wizardState.attributes, subcategory: wizardState.subcategory });

  const render = (field: CategoryField) => {
    if (!visible(field)) return null;
    const value = wizardState.attributes[field.key];
    const onChange = (v: unknown) => setAttr(field.key, v);
    switch (field.type) {
      case "text": return <TextField key={field.key} field={field} value={(value as string) || ""} onChange={onChange} />;
      case "textarea": return <TextareaField key={field.key} field={field} value={(value as string) || ""} onChange={onChange} />;
      case "number":
      case "year": return <NumberField key={field.key} field={field} value={value as number | undefined} onChange={onChange} />;
      case "select": return <SelectField key={field.key} field={field} value={(value as string) || ""} onChange={onChange} />;
      case "multiselect": return <MultiSelectField key={field.key} field={field} value={(value as string[]) || []} onChange={onChange} />;
      case "boolean": return <BooleanField key={field.key} field={field} value={value as boolean} onChange={onChange} />;
      default: return null;
    }
  };

  const noun = subcategory ? getSubcategoryLabel(category, subcategory).toLowerCase() : categoryConfig.name.toLowerCase();

  return (
    <>
      <Section title="About the piece" description="The title and story buyers read first.">
        <div className="space-y-6">
          <div>
            <Label text="Title" required htmlFor="title" right={`${wizardState.title.trim().length}/${TITLE_MAX}`} />
            <input id="title" maxLength={TITLE_MAX} value={wizardState.title} onChange={(e) => updateState({ title: e.target.value })} placeholder={`Name your ${noun}`} className={INPUT} />
          </div>
          <div>
            <Label text="Description" htmlFor="description" right={`${wizardState.description.length}/${DESCRIPTION_MAX}`} />
            <textarea id="description" rows={5} maxLength={DESCRIPTION_MAX} value={wizardState.description} onChange={(e) => updateState({ description: e.target.value })} placeholder="What it is, how you made it, what makes it yours." className={INPUT} />
          </div>
          <div className="sm:max-w-xs">
            <Label text="Year created" htmlFor="year" />
            <Select id="year" value={wizardState.yearCreated || ""} onChange={(e) => updateState({ yearCreated: e.target.value ? parseInt(e.target.value, 10) : null })}>
              <option value="">Select year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </div>
      </Section>

      {groups.classification.length > 0 && (
        <Section title="Classification"><div className="space-y-6">{groups.classification.map(render)}</div></Section>
      )}
      {deliveryType !== "digital" && groups.presentation.length > 0 && (
        <Section title="Presentation"><div className="space-y-6">{groups.presentation.map(render)}</div></Section>
      )}
      {groups.details.length > 0 && (
        <Section title="More details"><div className="space-y-6">{groups.details.map(render)}</div></Section>
      )}

      <Section title="Tags" description="A few words that help people find this.">
        <TagList values={wizardState.keywords} onChange={(keywords) => updateState({ keywords })} placeholder="watercolour, portrait, botanical" max={10} normalize chipPrefix="#" />
      </Section>
    </>
  );
}
