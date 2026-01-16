"use client";

import React, { useState, useRef } from "react";
import { PostBackground, BackgroundType } from "@/lib/types";

interface BackgroundPickerProps {
  value: PostBackground | null;
  onChange: (background: PostBackground | null) => void;
  onClose: () => void;
}

// Color palette - Elegant and artistic
const solidColors = [
  // Neutrals
  { id: "white", color: "#ffffff", label: "White" },
  { id: "cream", color: "#fdf8f3", label: "Cream" },
  { id: "parchment", color: "#f5f0e6", label: "Parchment" },
  { id: "pearl", color: "#f5f5f5", label: "Pearl" },
  // Warm
  { id: "blush", color: "#fce4e4", label: "Blush" },
  { id: "peach", color: "#ffe5d9", label: "Peach" },
  { id: "dusty-rose", color: "#dcb8b0", label: "Dusty Rose" },
  { id: "terracotta", color: "#c68b77", label: "Terracotta" },
  // Cool
  { id: "sky", color: "#e6f2ff", label: "Sky" },
  { id: "lavender", color: "#e6e6fa", label: "Lavender" },
  { id: "sage", color: "#d4e4d4", label: "Sage" },
  { id: "mint", color: "#d5f5e3", label: "Mint" },
  // Deep
  { id: "ink", color: "#1e1e1e", label: "Ink" },
  { id: "midnight", color: "#1a1a2e", label: "Midnight" },
  { id: "forest", color: "#1d3d2e", label: "Forest" },
  { id: "wine", color: "#4a1c2e", label: "Wine" },
];

// Gradient presets
const gradientPresets = [
  { id: "purple-dream", value: "linear-gradient(135deg, #8e44ad 0%, #c39bd3 100%)", label: "Purple Dream" },
  { id: "sunset", value: "linear-gradient(135deg, #ff9f43 0%, #ff007f 100%)", label: "Sunset" },
  { id: "ocean", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Ocean" },
  { id: "forest", value: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)", label: "Forest" },
  { id: "rose-gold", value: "linear-gradient(135deg, #b76e79 0%, #eacda3 100%)", label: "Rose Gold" },
  { id: "twilight", value: "linear-gradient(135deg, #1a1a2e 0%, #4a4a6a 100%)", label: "Twilight" },
  { id: "morning-mist", value: "linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)", label: "Morning Mist" },
  { id: "aurora", value: "linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)", label: "Aurora" },
  { id: "warm-flame", value: "linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)", label: "Warm Flame" },
  { id: "night-sky", value: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", label: "Night Sky" },
  { id: "spring", value: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)", label: "Spring" },
  { id: "calm", value: "linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%)", label: "Calm" },
];

// Pattern presets
const patternPresets = [
  { id: "paper-vintage", label: "Vintage Paper", css: "repeating-linear-gradient(45deg, #f5f0e6 0px, #f5f0e6 2px, #ebe6dc 2px, #ebe6dc 4px)" },
  { id: "linen", label: "Linen", css: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px), #faf8f5" },
  { id: "dots-soft", label: "Soft Dots", css: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0), #ffffff" },
  { id: "grid-light", label: "Light Grid", css: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px), #ffffff" },
  { id: "diagonal", label: "Diagonal Lines", css: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px), #fafafa" },
  { id: "watercolor", label: "Watercolor", css: "radial-gradient(ellipse at 20% 80%, rgba(142, 68, 173, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255, 0, 127, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(255, 159, 67, 0.06) 0%, transparent 60%), #fdfcfb" },
  { id: "grain", label: "Grain", css: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E\"), #faf9f7" },
  { id: "notebook", label: "Notebook", css: "linear-gradient(#e8e8e8 1px, transparent 1px), #ffffff" },
];

const icons = {
  color: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  gradient: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="url(#grad)" strokeWidth="2" />
    </svg>
  ),
  pattern: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  image: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  remove: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
};

type Tab = "color" | "gradient" | "pattern" | "image";

export default function BackgroundPicker({ value, onChange, onClose }: BackgroundPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("color");
  const [customColor, setCustomColor] = useState(value?.type === "solid" ? value.value : "#8e44ad");
  const [imagePreview, setImagePreview] = useState<string | null>(value?.type === "image" ? value.imageUrl || null : null);
  const [imageOpacity, setImageOpacity] = useState(value?.opacity ?? 1);
  const [imageBlur, setImageBlur] = useState(value?.blur ?? 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "color", label: "Color", icon: icons.color },
    { id: "gradient", label: "Gradient", icon: icons.gradient },
    { id: "pattern", label: "Pattern", icon: icons.pattern },
    { id: "image", label: "Image", icon: icons.image },
  ];

  const handleSelectColor = (color: string) => {
    onChange({ type: "solid", value: color });
  };

  const handleSelectGradient = (gradientValue: string) => {
    onChange({ type: "gradient", value: gradientValue });
  };

  const handleSelectPattern = (patternCss: string) => {
    onChange({ type: "pattern", value: patternCss });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      onChange({
        type: "image",
        value: dataUrl,
        imageUrl: dataUrl,
        opacity: imageOpacity,
        blur: imageBlur,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImageSettingsChange = (newOpacity?: number, newBlur?: number) => {
    const opacity = newOpacity ?? imageOpacity;
    const blur = newBlur ?? imageBlur;

    if (newOpacity !== undefined) setImageOpacity(newOpacity);
    if (newBlur !== undefined) setImageBlur(newBlur);

    if (imagePreview) {
      onChange({
        type: "image",
        value: imagePreview,
        imageUrl: imagePreview,
        opacity,
        blur,
      });
    }
  };

  const handleRemoveBackground = () => {
    onChange(null);
    setImagePreview(null);
  };

  const isSelected = (type: BackgroundType, checkValue: string) => {
    return value?.type === type && value?.value === checkValue;
  };

  const renderPreview = () => {
    if (!value) {
      return (
        <div className="w-full h-32 rounded-xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center">
          <span className="text-muted text-sm font-ui">No background selected</span>
        </div>
      );
    }

    let style: React.CSSProperties = {};

    if (value.type === "solid") {
      style.backgroundColor = value.value;
    } else if (value.type === "gradient") {
      style.background = value.value;
    } else if (value.type === "pattern") {
      style.background = value.value;
      style.backgroundSize = value.value.includes("dots") ? "20px 20px" :
                             value.value.includes("grid") ? "20px 20px" :
                             value.value.includes("notebook") ? "100% 24px" : "auto";
    } else if (value.type === "image" && value.imageUrl) {
      style.backgroundImage = `url(${value.imageUrl})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
      style.opacity = value.opacity ?? 1;
      style.filter = value.blur ? `blur(${value.blur}px)` : undefined;
    }

    return (
      <div className="w-full h-32 rounded-xl overflow-hidden shadow-inner relative">
        <div className="absolute inset-0" style={style} />
        {value.type === "image" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-ui backdrop-blur-sm"
              style={{ filter: "none", opacity: 1 }}
            >
              Image Background
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-display text-xl text-ink">Choose Background</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center text-muted transition-colors"
          >
            {icons.close}
          </button>
        </div>

        {/* Preview */}
        <div className="px-6 pt-4">
          {renderPreview()}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-ui text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/30"
                  : "text-muted hover:bg-black/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {/* Remove Background Button */}
          <button
            onClick={handleRemoveBackground}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50 text-muted hover:text-red-500 font-ui text-sm transition-all"
          >
            {icons.remove}
            Remove Background
          </button>

          {/* Color Tab */}
          {activeTab === "color" && (
            <div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {solidColors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectColor(c.color)}
                    className={`relative w-full aspect-square rounded-xl transition-all ${
                      isSelected("solid", c.color)
                        ? "ring-2 ring-purple-primary ring-offset-2 scale-105"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  >
                    {isSelected("solid", c.color) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          c.color === "#ffffff" || c.color.startsWith("#f") ? "bg-purple-primary text-white" : "bg-white text-purple-primary"
                        }`}>
                          {icons.check}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    handleSelectColor(e.target.value);
                  }}
                  className="w-12 h-12 rounded-lg cursor-pointer border-0"
                />
                <div className="flex-1">
                  <label className="font-ui text-xs text-muted uppercase tracking-wide">Custom Color</label>
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomColor(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        handleSelectColor(val);
                      }
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 font-ui text-sm text-ink focus:outline-none focus:border-purple-primary"
                    placeholder="#8e44ad"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gradient Tab */}
          {activeTab === "gradient" && (
            <div className="grid grid-cols-3 gap-3">
              {gradientPresets.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleSelectGradient(g.value)}
                  className={`relative h-20 rounded-xl transition-all ${
                    isSelected("gradient", g.value)
                      ? "ring-2 ring-purple-primary ring-offset-2 scale-105"
                      : "hover:scale-105"
                  }`}
                  style={{ background: g.value }}
                  title={g.label}
                >
                  {isSelected("gradient", g.value) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-white text-purple-primary flex items-center justify-center">
                        {icons.check}
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center text-[10px] font-ui text-white/90 bg-black/20 rounded-md px-1 py-0.5 backdrop-blur-sm">
                    {g.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Pattern Tab */}
          {activeTab === "pattern" && (
            <div className="grid grid-cols-2 gap-3">
              {patternPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPattern(p.css)}
                  className={`relative h-24 rounded-xl transition-all overflow-hidden ${
                    isSelected("pattern", p.css)
                      ? "ring-2 ring-purple-primary ring-offset-2 scale-[1.02]"
                      : "hover:scale-[1.02]"
                  }`}
                  style={{
                    background: p.css,
                    backgroundSize: p.id === "dots-soft" || p.id === "grid-light" ? "20px 20px" :
                                   p.id === "notebook" ? "100% 24px" : "auto"
                  }}
                  title={p.label}
                >
                  {isSelected("pattern", p.css) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="w-6 h-6 rounded-full bg-purple-primary text-white flex items-center justify-center">
                        {icons.check}
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center text-xs font-ui text-ink/80 bg-white/80 rounded-md px-2 py-1 backdrop-blur-sm">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Image Tab */}
          {activeTab === "image" && (
            <div>
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-primary/30 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-primary/50 hover:bg-purple-primary/[0.02] transition-all"
                >
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white shadow-lg shadow-purple-primary/30">
                    {icons.upload}
                  </div>
                  <p className="font-ui text-ink mb-1">Upload Background Image</p>
                  <p className="font-body text-sm text-muted">JPG, PNG, or WebP - Max 5MB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Image Preview */}
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={imagePreview}
                      alt="Background preview"
                      className="w-full h-40 object-cover"
                      style={{
                        opacity: imageOpacity,
                        filter: imageBlur > 0 ? `blur(${imageBlur}px)` : undefined,
                      }}
                    />
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        onChange(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                    >
                      {icons.close}
                    </button>
                  </div>

                  {/* Opacity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-ui text-xs text-muted uppercase tracking-wide">Opacity</label>
                      <span className="font-ui text-sm text-ink">{Math.round(imageOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={imageOpacity}
                      onChange={(e) => handleImageSettingsChange(parseFloat(e.target.value), undefined)}
                      className="w-full accent-purple-primary"
                    />
                  </div>

                  {/* Blur Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-ui text-xs text-muted uppercase tracking-wide">Blur</label>
                      <span className="font-ui text-sm text-ink">{imageBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={imageBlur}
                      onChange={(e) => handleImageSettingsChange(undefined, parseInt(e.target.value))}
                      className="w-full accent-purple-primary"
                    />
                  </div>

                  {/* Change Image Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2.5 rounded-xl border border-purple-primary/30 text-purple-primary font-ui text-sm hover:bg-purple-primary/5 transition-colors"
                  >
                    Change Image
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.06] bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full font-ui text-sm text-muted hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium shadow-lg shadow-purple-primary/30 hover:shadow-xl hover:shadow-purple-primary/40 transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
