"use client";

import { TagList } from "@/components/listing/form";

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helperText?: string;
  max?: number;
  /** Lowercase tags before adding (hashtag-style keywords). */
  lowercase?: boolean;
  /** Optional `#` prefix on the chip (purely visual). */
  chipPrefix?: string;
}

/** Thin wrapper over the shared TagList, kept for the seller settings page and the product wizard. */
export default function TagInput({ values, onChange, placeholder = "Add…", helperText, max, lowercase = false, chipPrefix }: TagInputProps) {
  return <TagList values={values} onChange={onChange} placeholder={placeholder} helperText={helperText} max={max} normalize={lowercase} chipPrefix={chipPrefix} />;
}
