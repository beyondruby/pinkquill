# Contributing to Quill

Thank you for your interest in contributing to Quill! This document provides guidelines and standards for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Code of Conduct

Be respectful and inclusive. We welcome contributions from everyone.

## Getting Started

### Prerequisites

- Node.js 20.x (see `.nvmrc`)
- npm or yarn
- Supabase account (for local development)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/quill.git
cd quill

# Use correct Node version
nvm use

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Write/update tests
4. Run linting and tests
5. Submit a pull request

### Branch Naming

- `feat/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes

## Code Standards

### TypeScript

- Use strict TypeScript (`strict: true`)
- Define interfaces for all props and state
- Avoid `any` type - use `unknown` if type is truly unknown
- Export types from `lib/types/index.ts`

```typescript
// Good
interface PostCardProps {
  post: Post;
  onAdmire: (postId: string) => void;
}

// Avoid
interface PostCardProps {
  post: any;
  onAdmire: Function;
}
```

### React Components

- Use functional components with hooks
- Memoize expensive computations with `useMemo`
- Memoize callbacks with `useCallback`
- Use `memo()` for components that receive stable props

```typescript
// Good
const PostCard = memo(function PostCard({ post, onAdmire }: PostCardProps) {
  const formattedDate = useMemo(() => formatDate(post.created_at), [post.created_at]);
  const handleAdmire = useCallback(() => onAdmire(post.id), [post.id, onAdmire]);

  return <div>...</div>;
});

// Avoid
const PostCard = ({ post, onAdmire }) => {
  const formattedDate = formatDate(post.created_at); // Recalculates every render
  return <div>...</div>;
};
```

### Hooks

- Place hooks in `lib/hooks/`
- Return typed objects, not arrays
- Handle loading, error, and data states
- Clean up subscriptions and abort controllers

```typescript
// Good
export function useFeed(userId?: string): UseFeedReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { posts, loading, error, refetch };
}
```

### File Organization

```
components/
├── feature/
│   ├── ComponentName.tsx    # Component file
│   ├── ComponentName.test.tsx  # Tests
│   └── index.ts             # Barrel export (optional)
```

### CSS/Styling

- Use Tailwind CSS utility classes
- Use CSS variables for theme values (defined in `globals.css`)
- Prefer composition over complex selectors

```tsx
// Good
<button className="px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-600">
  Click me
</button>

// Avoid inline styles
<button style={{ padding: '8px 16px', backgroundColor: '#8e44ad' }}>
  Click me
</button>
```

### Error Handling

- Use the `categorizeError` utility for consistent error handling
- Always handle potential null/undefined values
- Provide user-friendly error messages

```typescript
import { categorizeError } from "@/lib/utils";

try {
  const result = await fetchData();
} catch (err) {
  const { category, message, isRetryable } = categorizeError(err);
  if (isRetryable) {
    // Implement retry logic
  }
  setError(message);
}
```

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(posts): add collaboration invite system
fix(auth): validate redirect URLs to prevent open redirect
test(hooks): add useFeed test coverage
docs(readme): update installation instructions
refactor(feed): split useFeed into smaller modules
```

### Rules

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep first line under 72 characters
- Reference issues in footer: `Closes #123`

## Pull Request Process

### Before Submitting

1. **Run linting**: `npm run lint`
2. **Run tests**: `npm run test`
3. **Check types**: `npx tsc --noEmit`
4. **Update documentation** if needed

### PR Requirements

- Clear title following commit conventions
- Description of changes
- Screenshots for UI changes
- Tests for new functionality
- No decrease in test coverage

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Screenshots (if applicable)
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- lib/hooks/__tests__/useFeed.test.ts
```

### Writing Tests

- Place tests in `__tests__` folders or as `.test.ts(x)` files
- Use descriptive test names
- Test happy paths and edge cases
- Mock external dependencies

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFeed } from "../useFeed";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

describe("useFeed", () => {
  it("should fetch posts on mount", async () => {
    const { result } = renderHook(() => useFeed());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toBeDefined();
  });
});
```

### Test Coverage Goals

- **Hooks**: 80%+ coverage
- **Utilities**: 90%+ coverage
- **Components**: 70%+ coverage

## Questions?

Open an issue or reach out to the maintainers.
