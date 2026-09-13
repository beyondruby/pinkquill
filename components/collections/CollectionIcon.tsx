"use client";

import React from "react";
import type { Collection } from "@/lib/types";

import { brandedIcons } from "./collectionIcons";

/** The collection's chosen icon: a branded key, an emoji (raw or hex code point), or an uploaded image. */
export function CollectionIcon({ collection }: { collection: Collection }) {
  if (collection.icon_emoji?.startsWith("icon:")) {
    const icon = brandedIcons.find((item) => item.id === collection.icon_emoji) ?? brandedIcons.find((item) => item.id === "icon:folder");
    return <>{icon?.icon}</>;
  }
  if (collection.icon_emoji?.startsWith("url:")) return <img src={collection.icon_emoji.slice(4)} alt="" />;
  if (collection.icon_emoji) {
    if (/^[0-9A-Fa-f]+$/.test(collection.icon_emoji)) {
      const codePoint = parseInt(collection.icon_emoji, 16);
      return codePoint <= 0x10ffff ? <span>{String.fromCodePoint(codePoint)}</span> : null;
    }
    return <span>{collection.icon_emoji}</span>;
  }
  if (collection.icon_url) {
    return <img src={collection.icon_url} alt="" />;
  }
  return null;
}

