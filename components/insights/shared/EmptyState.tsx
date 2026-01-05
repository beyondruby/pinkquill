"use client";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon ? (
        <div className="w-16 h-16 rounded-full bg-purple-primary/5 flex items-center justify-center mb-4 text-purple-primary/40">
          {icon}
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-purple-primary/5 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-purple-primary/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
      )}
      <h3 className="font-display text-lg text-ink mb-2">{title}</h3>
      <p className="font-body text-sm text-muted text-center max-w-xs mb-4">
        {description}
      </p>
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-full font-ui text-sm hover:shadow-lg transition-all"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-full font-ui text-sm hover:shadow-lg transition-all"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
