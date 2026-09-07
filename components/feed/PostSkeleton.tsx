"use client";

export default function PostSkeleton() {
  return (
    <div className="post-skeleton">
      {/* Author header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-avatar" />
        <div className="skeleton-author-info">
          <div className="skeleton-name" />
          <div className="skeleton-meta" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-full" />
        <div className="skeleton-line skeleton-line-medium" />
        <div className="skeleton-line skeleton-line-short" />
      </div>

      {/* Actions skeleton */}
      <div className="skeleton-actions">
        <div className="skeleton-action" />
        <div className="skeleton-action" />
        <div className="skeleton-action" />
        <div className="skeleton-action" />
      </div>

      <style jsx>{`
        .post-skeleton {
          background: var(--paper, #ffffff);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .skeleton-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .skeleton-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
        }

        .skeleton-author-info {
          flex: 1;
        }

        .skeleton-name {
          height: 16px;
          width: 140px;
          border-radius: 4px;
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
          margin-bottom: 8px;
        }

        .skeleton-meta {
          height: 12px;
          width: 100px;
          border-radius: 4px;
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
          animation-delay: 0.1s;
        }

        .skeleton-content {
          margin-bottom: 20px;
        }

        .skeleton-line {
          height: 14px;
          border-radius: 4px;
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
          margin-bottom: 10px;
        }

        .skeleton-line-full {
          width: 100%;
        }

        .skeleton-line-medium {
          width: 75%;
          animation-delay: 0.2s;
        }

        .skeleton-line-short {
          width: 50%;
          animation-delay: 0.3s;
        }

        .skeleton-actions {
          display: flex;
          gap: 24px;
          padding-top: 16px;
          border-top: 1px solid #f0f0f0;
        }

        .skeleton-action {
          width: 60px;
          height: 20px;
          border-radius: 4px;
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
        }

        .skeleton-action:nth-child(2) {
          animation-delay: 0.1s;
        }

        .skeleton-action:nth-child(3) {
          animation-delay: 0.2s;
        }

        .skeleton-action:nth-child(4) {
          animation-delay: 0.3s;
        }

        @keyframes skeleton-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
