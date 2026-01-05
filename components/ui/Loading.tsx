"use client";

interface LoadingProps {
  text?: string;
  size?: "small" | "medium" | "large";
  className?: string;
}

export default function Loading({ text = "Loading", size = "medium", className = "" }: LoadingProps) {
  const sizeStyles = {
    small: { container: 60, svg: 36 },
    medium: { container: 80, svg: 48 },
    large: { container: 100, svg: 60 },
  };

  const sizes = sizeStyles[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className="takes-loading-quill"
        style={{ width: sizes.container, height: sizes.container }}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: sizes.svg, height: sizes.svg }}
        >
          <defs>
            <linearGradient id="loadingQuillGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8e44ad">
                <animate
                  attributeName="stop-color"
                  values="#8e44ad;#ff007f;#ff9f43;#8e44ad"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="50%" stopColor="#ff007f">
                <animate
                  attributeName="stop-color"
                  values="#ff007f;#ff9f43;#8e44ad;#ff007f"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="#ff9f43">
                <animate
                  attributeName="stop-color"
                  values="#ff9f43;#8e44ad;#ff007f;#ff9f43"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          </defs>
          <path
            d="M28 2C22 4 18 8 15 13C12 18 10 22 9 25L7 30L8.5 28.5C9.5 27.5 11 26 13 24.5C14.5 23.5 16.5 22.5 19 22C17 20 15.5 17.5 15 15C18 15.5 21 17 23 19C23.5 16.5 24.5 14.5 25.5 13C27 14.5 28 16.5 28.5 19C30 15 31 10 28 2Z"
            fill="url(#loadingQuillGradient)"
            className="takes-quill-body"
          />
          <path
            d="M27 3C21 7 16 14 12 21C10 25 8 28 7 30"
            stroke="url(#loadingQuillGradient)"
            strokeWidth="1.2"
            strokeLinecap="round"
            className="takes-quill-spine"
          />
          <path
            d="M24 6C22 8 20 10 18 13M26 8C23 11 20 14 17 17M25 12C22 15 19 18 16 20"
            stroke="url(#loadingQuillGradient)"
            strokeWidth="0.8"
            strokeLinecap="round"
            className="takes-quill-barbs"
          />
        </svg>
        <div className="takes-loading-ripple" />
        <div className="takes-loading-ripple ripple-2" />
      </div>
      {text && (
        <>
          <p className="takes-loading-text">{text}</p>
          <div className="takes-loading-dots">
            <span /><span /><span />
          </div>
        </>
      )}
    </div>
  );
}

// Full page loading wrapper
export function FullPageLoading({ text = "Loading" }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loading text={text} size="large" />
    </div>
  );
}
