# Hook Refactoring Guide

This document provides a plan for splitting large hook files into smaller, more maintainable modules.

## Files to Refactor

| File | Current Size | Target Modules |
|------|-------------|----------------|
| `useTakes.ts` | 1,973 LOC | 4 modules |
| `useInsights.ts` | 1,486 LOC | 3 modules |

## Refactoring Strategy

### 1. useTakes.ts Split Plan

Current structure has multiple responsibilities:
- Takes feed fetching
- Take creation/upload
- Take player state
- Take comments

**Proposed Split:**

```
lib/hooks/takes/
├── index.ts              # Barrel exports
├── useTakesFeed.ts       # Feed fetching, pagination, filtering
├── useCreateTake.ts      # Take creation, video upload, processing
├── useTakePlayer.ts      # Video playback state, controls
├── useTakeComments.ts    # Comments on takes
└── types.ts              # Take-specific types
```

**Migration Steps:**

1. Create `lib/hooks/takes/` directory
2. Extract `useTakesFeed` - all feed-related logic
3. Extract `useCreateTake` - creation and upload logic
4. Extract `useTakePlayer` - playback state management
5. Extract `useTakeComments` - comment system
6. Create barrel export in `index.ts`
7. Update imports in components
8. Add tests for each module
9. Remove old `useTakes.ts`

### 2. useInsights.ts Split Plan

Current structure has:
- Overview metrics
- Audience analytics
- Content performance
- Date range handling

**Proposed Split:**

```
lib/hooks/insights/
├── index.ts                  # Barrel exports
├── useInsightsOverview.ts    # Dashboard summary metrics
├── useInsightsAudience.ts    # Follower demographics, growth
├── useInsightsContent.ts     # Post performance analytics
├── useInsightsDateRange.ts   # Date range state and filtering
└── types.ts                  # Insights-specific types
```

## Example: Splitting useTakesFeed

Here's an example of how to extract the feed functionality:

```typescript
// lib/hooks/takes/useTakesFeed.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Take, PaginationState } from "./types";

interface UseTakesFeedOptions {
  pageSize?: number;
  userId?: string;
}

interface UseTakesFeedReturn {
  takes: Take[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTakesFeed(options: UseTakesFeedOptions = {}): UseTakesFeedReturn {
  const { pageSize = 20, userId } = options;

  const [takes, setTakes] = useState<Take[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize,
    hasMore: true,
  });

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTakes = useCallback(async (page: number, append: boolean = false) => {
    // ... implementation
  }, [pageSize, userId]);

  const loadMore = useCallback(async () => {
    if (pagination.hasMore && !loading) {
      await fetchTakes(pagination.page + 1, true);
    }
  }, [fetchTakes, pagination, loading]);

  const refresh = useCallback(async () => {
    setPagination({ page: 0, pageSize, hasMore: true });
    await fetchTakes(0, false);
  }, [fetchTakes, pageSize]);

  useEffect(() => {
    fetchTakes(0);
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [fetchTakes]);

  return { takes, loading, error, pagination, loadMore, refresh };
}
```

## Barrel Export Pattern

```typescript
// lib/hooks/takes/index.ts
export { useTakesFeed } from "./useTakesFeed";
export { useCreateTake } from "./useCreateTake";
export { useTakePlayer } from "./useTakePlayer";
export { useTakeComments } from "./useTakeComments";
export type * from "./types";
```

## Updating Components

Before:
```typescript
import { useTakes } from "@/lib/hooks/useTakes";

const { takes, loading, createTake, playTake } = useTakes();
```

After:
```typescript
import { useTakesFeed, useCreateTake, useTakePlayer } from "@/lib/hooks/takes";

const { takes, loading } = useTakesFeed();
const { createTake, uploading } = useCreateTake();
const { play, pause, currentTime } = useTakePlayer(takeId);
```

## Testing Strategy

Each extracted hook should have:
1. Unit tests for core functionality
2. Mock Supabase client
3. Test async operations and cleanup
4. Test error handling

Example test structure:
```typescript
// lib/hooks/takes/__tests__/useTakesFeed.test.ts
describe("useTakesFeed", () => {
  it("should fetch takes on mount", async () => {});
  it("should handle pagination", async () => {});
  it("should refresh takes", async () => {});
  it("should handle errors gracefully", async () => {});
  it("should cleanup on unmount", async () => {});
});
```

## Migration Checklist

- [ ] Create new directory structure
- [ ] Extract first hook module
- [ ] Add tests for extracted module
- [ ] Update one component to use new import
- [ ] Verify component works
- [ ] Repeat for remaining modules
- [ ] Update all component imports
- [ ] Remove old monolithic file
- [ ] Update barrel exports in lib/hooks/index.ts
- [ ] Run full test suite
- [ ] Update documentation

## Benefits of This Refactor

1. **Smaller bundle sizes** - Components only import what they need
2. **Easier testing** - Isolated modules are simpler to test
3. **Better code organization** - Related code lives together
4. **Improved maintainability** - Smaller files are easier to understand
5. **Faster development** - Less context switching
