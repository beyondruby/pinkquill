"use client";

import { useState, useEffect, useRef } from "react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  description?: string;
  type?: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  imageUrl?: string;
}

// Social Icons
const icons = {
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  copy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  code: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  linkedin: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  pinterest: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  telegram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  email: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  reddit: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  ),
  download: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
};

export default function ShareModal({
  isOpen,
  onClose,
  url,
  title = "Check this out!",
  description = "",
  type = "post",
  authorName = "",
  authorUsername = "",
  authorAvatar = "",
  imageUrl = "",
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"share" | "embed" | "instagram">("share");
  const [storyGenerating, setStoryGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setEmbedCopied(false);
      setActiveTab("share");
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shareText = authorName
    ? `${title} by ${authorName} on PinkQuill`
    : `${title} on PinkQuill`;

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);
  const encodedTitle = encodeURIComponent(title);

  const socialLinks = [
    {
      name: "X",
      icon: icons.twitter,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      color: "#000000",
    },
    {
      name: "Facebook",
      icon: icons.facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "#1877F2",
    },
    {
      name: "LinkedIn",
      icon: icons.linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: "#0A66C2",
    },
    {
      name: "Reddit",
      icon: icons.reddit,
      url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      color: "#FF4500",
    },
    {
      name: "Pinterest",
      icon: icons.pinterest,
      url: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`,
      color: "#E60023",
    },
    {
      name: "WhatsApp",
      icon: icons.whatsapp,
      url: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
      color: "#25D366",
    },
    {
      name: "Telegram",
      icon: icons.telegram,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      color: "#0088CC",
    },
    {
      name: "Email",
      icon: icons.email,
      url: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
      color: "#8e44ad",
    },
  ];

  const embedCode = `<iframe src="${url}/embed" width="100%" height="400" frameborder="0" style="border-radius: 12px; max-width: 580px;"></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSocialClick = (socialUrl: string) => {
    window.open(socialUrl, "_blank", "width=600,height=400,noopener,noreferrer");
  };

  // Get first N words of description (strips HTML)
  const getFirstNWords = (text: string, n: number) => {
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    const words = cleanText.split(/\s+/);
    return words.slice(0, n).join(' ') + (words.length > n ? '...' : '');
  };

  const hasImage = !!imageUrl;

  // Helper to wrap text into lines
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Generate Instagram Story image
  const generateStoryImage = async (): Promise<string | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Instagram Story dimensions (9:16 aspect ratio)
    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // ========== WATERCOLOR BACKGROUND ==========
    // Base gradient (soft pink tones)
    const baseGradient = ctx.createLinearGradient(0, 0, width, height);
    baseGradient.addColorStop(0, '#fdf2f8');     // Very light pink
    baseGradient.addColorStop(0.3, '#fce7f3');   // Soft pink
    baseGradient.addColorStop(0.6, '#fbcfe8');   // Light pink
    baseGradient.addColorStop(1, '#f9a8d4');     // Pink
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, width, height);

    // Watercolor blob 1 - Purple (top left)
    const blob1Gradient = ctx.createRadialGradient(width * 0.2, height * 0.15, 0, width * 0.2, height * 0.15, width * 0.5);
    blob1Gradient.addColorStop(0, 'rgba(142, 68, 173, 0.15)');
    blob1Gradient.addColorStop(0.5, 'rgba(142, 68, 173, 0.08)');
    blob1Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = blob1Gradient;
    ctx.fillRect(0, 0, width, height);

    // Watercolor blob 2 - Pink (center right)
    const blob2Gradient = ctx.createRadialGradient(width * 0.8, height * 0.4, 0, width * 0.8, height * 0.4, width * 0.6);
    blob2Gradient.addColorStop(0, 'rgba(255, 0, 127, 0.12)');
    blob2Gradient.addColorStop(0.5, 'rgba(255, 0, 127, 0.06)');
    blob2Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = blob2Gradient;
    ctx.fillRect(0, 0, width, height);

    // Watercolor blob 3 - Orange (bottom)
    const blob3Gradient = ctx.createRadialGradient(width * 0.5, height * 0.85, 0, width * 0.5, height * 0.85, width * 0.5);
    blob3Gradient.addColorStop(0, 'rgba(255, 159, 67, 0.1)');
    blob3Gradient.addColorStop(0.5, 'rgba(255, 159, 67, 0.05)');
    blob3Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = blob3Gradient;
    ctx.fillRect(0, 0, width, height);

    // Watercolor blob 4 - Purple (bottom left)
    const blob4Gradient = ctx.createRadialGradient(width * 0.1, height * 0.7, 0, width * 0.1, height * 0.7, width * 0.4);
    blob4Gradient.addColorStop(0, 'rgba(142, 68, 173, 0.08)');
    blob4Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = blob4Gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle paper texture overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < height; i += 4) {
      if (Math.random() > 0.5) {
        ctx.fillRect(0, i, width, 1);
      }
    }

    // ========== GLASS EFFECT CARD ==========
    const cardMargin = 50;
    const cardX = cardMargin;
    const cardY = height * 0.18;
    const cardWidth = width - (cardMargin * 2);
    const cardHeight = height * 0.65;
    const cardRadius = 40;

    // Glass card background - more transparent/see-through
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.clip();

    // Frosted glass effect - more transparent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    // Subtle inner glow
    const innerGlow = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
    innerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    innerGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    innerGlow.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    ctx.restore();

    // Card border (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.stroke();

    // ========== CARD CONTENT ==========
    const contentPadding = 60;
    const contentWidth = cardWidth - (contentPadding * 2);
    let contentY = cardY + 70;

    // Title (first 150 characters)
    const displayTitle = (title || 'Untitled').substring(0, 150) + ((title || '').length > 150 ? '...' : '');
    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 48px "Libre Baskerville", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const titleLines = wrapText(ctx, displayTitle, contentWidth);
    const titleLineHeight = 62;

    titleLines.forEach((line, i) => {
      ctx.fillText(line, width / 2, contentY + i * titleLineHeight);
    });
    contentY += titleLines.length * titleLineHeight + 40;

    // Decorative divider
    ctx.strokeStyle = 'rgba(142, 68, 173, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 60, contentY);
    ctx.lineTo(width / 2 + 60, contentY);
    ctx.stroke();
    contentY += 40;

    // Content excerpt (first 550 characters)
    const cleanDescription = (description || '').replace(/<[^>]*>/g, '').trim();
    const displayExcerpt = cleanDescription.substring(0, 550) + (cleanDescription.length > 550 ? '...' : '');

    if (displayExcerpt) {
      ctx.fillStyle = '#444444';
      ctx.font = 'italic 32px "Crimson Pro", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const excerptLines = wrapText(ctx, displayExcerpt, contentWidth);
      const excerptLineHeight = 42;

      excerptLines.slice(0, 12).forEach((line, i) => {
        ctx.fillText(line, width / 2, contentY + i * excerptLineHeight);
      });
      contentY += Math.min(excerptLines.length, 12) * excerptLineHeight + 40;
    }

    // "follow @username on pinkquill" at bottom of card
    const followY = cardY + cardHeight - 80;
    const cleanUsername = (authorUsername || 'anonymous').replace(/^@/, '');

    ctx.fillStyle = '#666666';
    ctx.font = '28px "Josefin Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`follow @${cleanUsername} on pinkquill.com`, width / 2, followY);

    // ========== PINKQUILL BRANDING AT BOTTOM OF PHOTO (OUTSIDE CARD) ==========
    const brandY = height - 80;

    ctx.fillStyle = 'rgba(80, 80, 80, 0.7)';
    ctx.font = '26px "Josefin Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PinkQuill — share your creative journey', width / 2, brandY);

    return canvas.toDataURL('image/png');
  };

  // Download story image
  const handleDownloadStory = async () => {
    setStoryGenerating(true);
    try {
      const dataUrl = await generateStoryImage();
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `pinkquill-story-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Failed to generate story:', err);
    } finally {
      setStoryGenerating(false);
    }
  };

  // Share to Instagram (mobile only - uses Web Share API)
  const handleShareToInstagram = async () => {
    setStoryGenerating(true);
    try {
      const dataUrl = await generateStoryImage();
      if (dataUrl && navigator.share && navigator.canShare) {
        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'pinkquill-story.png', { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title,
            text: `${title} on PinkQuill`,
          });
        } else {
          // Fallback to download
          handleDownloadStory();
        }
      } else {
        // Fallback to download
        handleDownloadStory();
      }
    } catch (err) {
      console.error('Failed to share:', err);
      // Fallback to download on error
      handleDownloadStory();
    } finally {
      setStoryGenerating(false);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="share-modal-header">
          <h3 className="share-modal-title">Share this {type}</h3>
          <button className="share-modal-close" onClick={onClose}>
            {icons.close}
          </button>
        </div>

        {/* Tabs */}
        <div className="share-tabs">
          <button
            className={`share-tab ${activeTab === "share" ? "active" : ""}`}
            onClick={() => setActiveTab("share")}
          >
            Share
          </button>
          <button
            className={`share-tab ${activeTab === "instagram" ? "active" : ""}`}
            onClick={() => setActiveTab("instagram")}
          >
            <span className="flex items-center gap-1.5">
              {icons.instagram}
              Story
            </span>
          </button>
          <button
            className={`share-tab ${activeTab === "embed" ? "active" : ""}`}
            onClick={() => setActiveTab("embed")}
          >
            Embed
          </button>
        </div>

        {/* Hidden canvas for story generation */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {activeTab === "share" && (
          <>
            {/* Copy Link */}
            <div className="share-copy-section">
              <div className="share-link-input">
                <input type="text" value={url} readOnly />
                <button
                  className={`share-copy-btn ${copied ? "copied" : ""}`}
                  onClick={handleCopyLink}
                >
                  {copied ? icons.check : icons.copy}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Social Share Grid */}
            <div className="share-social-grid">
              {socialLinks.map((social) => (
                <button
                  key={social.name}
                  className="share-social-btn"
                  onClick={() => handleSocialClick(social.url)}
                  style={{ "--social-color": social.color } as React.CSSProperties}
                >
                  <span className="share-social-icon">{social.icon}</span>
                  <span className="share-social-name">{social.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === "instagram" && (
          <div className="share-instagram-section">
            {/* Story Preview */}
            <div className="story-preview-container">
              <div className="story-preview story-preview-watercolor">
                {/* Watercolor Background */}
                <div className="story-watercolor-bg">
                  <div className="story-watercolor-blob blob-purple-1" />
                  <div className="story-watercolor-blob blob-pink" />
                  <div className="story-watercolor-blob blob-orange" />
                  <div className="story-watercolor-blob blob-purple-2" />
                </div>

                {/* Glass Card */}
                <div className="story-glass-card">
                  {/* Title */}
                  <h4 className="story-card-title">
                    {(title || 'Untitled').substring(0, 150)}{(title || '').length > 150 ? '...' : ''}
                  </h4>

                  {/* Decorative divider */}
                  <div className="story-card-divider" />

                  {/* Content excerpt */}
                  {description && (
                    <p className="story-card-excerpt">
                      {description.replace(/<[^>]*>/g, '').substring(0, 550)}
                      {description.replace(/<[^>]*>/g, '').length > 550 ? '...' : ''}
                    </p>
                  )}

                  {/* Follow text */}
                  <div className="story-card-follow">
                    follow @{(authorUsername || 'anonymous').replace(/^@/, '')} on pinkquill.com
                  </div>
                </div>

                {/* Branding outside card at bottom */}
                <div className="story-bottom-brand">
                  PinkQuill — share your creative journey
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="story-actions">
              <button
                className="story-share-btn"
                onClick={handleShareToInstagram}
                disabled={storyGenerating}
              >
                {storyGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {icons.instagram}
                    Share to Story
                  </span>
                )}
              </button>

              <button
                className="story-download-btn"
                onClick={handleDownloadStory}
                disabled={storyGenerating}
              >
                <span className="flex items-center gap-2">
                  {icons.download}
                  Download Image
                </span>
              </button>
            </div>

            <p className="story-hint">
              On mobile, tapping &ldquo;Share to Story&rdquo; will open your share menu.
              On desktop, download the image and upload it to Instagram manually.
            </p>
          </div>
        )}

        {activeTab === "embed" && (
          <div className="share-embed-section">
            <p className="share-embed-label">
              Copy and paste this code to embed on your website
            </p>
            <div className="share-embed-code">
              <pre>{embedCode}</pre>
              <button
                className={`share-copy-btn ${embedCopied ? "copied" : ""}`}
                onClick={handleCopyEmbed}
              >
                {embedCopied ? icons.check : icons.copy}
                <span>{embedCopied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
            <div className="share-embed-preview">
              <span className="share-embed-preview-label">Preview</span>
              <div className="share-embed-preview-box">
                <div className="share-embed-preview-content">
                  {title && <p className="share-embed-preview-title">{title}</p>}
                  <p className="share-embed-preview-desc">
                    {description || "Content preview will appear here"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
