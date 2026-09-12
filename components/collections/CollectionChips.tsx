"use client";

import { useState } from "react";
import { useCollections } from "@/lib/hooks/useCollections";
import NewCollectionModal from "./NewCollectionModal";
import type { Collection } from "@/lib/types";
import "./collections.css";

interface Props {
  userId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** The composer's collection row: one chip per collection, multi-select, plus "New collection". */
export default function CollectionChips({ userId, selectedIds, onChange }: Props) {
  const { collections, refetch } = useCollections(userId);
  const [showNew, setShowNew] = useState(false);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const handleCreated = (collection: Collection) => {
    setShowNew(false);
    refetch();
    onChange([...selectedIds, collection.id]);
  };

  return (
    <>
      <div className="collection-chips" role="group" aria-label="Collections">
        {collections.map((c) => (
          <button key={c.id} type="button" aria-pressed={selectedIds.includes(c.id)} onClick={() => toggle(c.id)} className="collection-chip">
            {selectedIds.includes(c.id) && (
              <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {c.name}
          </button>
        ))}
        <button type="button" onClick={() => setShowNew(true)} className="collection-chip collection-chip--new">
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          New collection
        </button>
      </div>
      <NewCollectionModal isOpen={showNew} onClose={() => setShowNew(false)} onSaved={handleCreated} />
    </>
  );
}
