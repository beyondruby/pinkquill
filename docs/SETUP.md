# Development Setup Guide

This guide will help you set up the Quill project for local development.

## Prerequisites

- **Node.js**: v20.x (see `.nvmrc`)
- **npm**: v10.x or higher
- **Git**: For version control
- **Supabase Account**: For database and auth

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/quill.git
cd quill

# Use correct Node version (if using nvm)
nvm use

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Sentry (Optional - for error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn

# Feature Flags (Optional)
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### Getting Supabase Credentials

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings → API
3. Copy the "Project URL" and "anon public" key

## Database Setup

### Option 1: Use Existing Supabase Project

If connecting to an existing project, the migrations have already been applied.

### Option 2: Set Up New Project

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the migrations in order from `supabase/migrations/`

### Enable Realtime

Enable realtime for these tables in Supabase Dashboard → Database → Publications:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
```

## Available Scripts

```bash
# Development
npm run dev           # Start dev server
npm run build         # Production build
npm run start         # Start production server

# Code Quality
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript check

# Testing
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Run tests with coverage
```

## Project Structure

```
quill/
├── app/              # Next.js pages and routes
├── components/       # React components
├── lib/
│   ├── hooks/       # Custom React hooks
│   ├── types/       # TypeScript types
│   ├── utils/       # Utility functions
│   └── supabase.ts  # Supabase client
├── public/          # Static assets
└── supabase/        # Database migrations
```

## IDE Setup

### VS Code (Recommended)

Install these extensions:
- ESLint
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar) - for better TS support

Recommended settings (`.vscode/settings.json`):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Troubleshooting

### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors in IDE

```bash
# Restart TS server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

### Supabase connection issues

1. Check your `.env.local` has correct values
2. Verify the Supabase project is not paused
3. Check browser console for CORS errors

### Tests failing

```bash
# Run specific test file
npm run test -- lib/hooks/__tests__/useFeed.test.ts

# Update snapshots if needed
npm run test -- -u
```

## Git Hooks

The project uses Husky for git hooks:

- **commit-msg**: Validates commit message follows conventional commits

To skip hooks temporarily (not recommended):

```bash
git commit --no-verify -m "message"
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
- Read [DATABASE.md](./DATABASE.md) for schema documentation
- Read [CONTRIBUTING.md](../CONTRIBUTING.md) for code standards
