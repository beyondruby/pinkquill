"use client";

import Modal from "@/components/ui/Modal";
import CollectionView from "./CollectionView";
import type { Collection } from "@/lib/types";

export interface CollectionModalTarget {
  username: string;
  slug: string;
  collection?: Collection | null;
}

interface Props {
  target: CollectionModalTarget;
  isOpen: boolean;
  onClose: () => void;
}

/** A collection opened over the page it was clicked on. */
export default function CollectionModal({ target, isOpen, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={target.collection ? `${target.collection.name}, a collection` : "Collection"}>
      <div className="h-full w-full overflow-y-auto overscroll-contain">
        <div className="p-5 md:p-8">
          <CollectionView key={`${target.username}/${target.slug}`} username={target.username} slug={target.slug} initial={target.collection ?? null} onClose={onClose} />
        </div>
      </div>
    </Modal>
  );
}
