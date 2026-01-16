"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { CanvasData, ShadowStyle, PostBackground } from "@/lib/types";

export interface CanvasImage {
  id: string;
  file?: File;
  preview: string;
  mediaUrl?: string;
  canvasData: CanvasData;
}

interface CanvasEditorProps {
  images: CanvasImage[];
  onChange: (images: CanvasImage[]) => void;
  background?: PostBackground | null;
  aspectRatio?: number; // e.g., 16/9, 4/3, 1
}

const defaultCanvasData: CanvasData = {
  x: 0.25,
  y: 0.25,
  width: 0.5,
  height: 0.5,
  rotation: 0,
  zIndex: 1,
  borderRadius: 8,
  borderWidth: 0,
  borderColor: "#ffffff",
  shadow: "none",
};

const shadowStyles: Record<ShadowStyle, string> = {
  none: "none",
  soft: "0 4px 20px rgba(0, 0, 0, 0.1)",
  medium: "0 8px 30px rgba(0, 0, 0, 0.2)",
  strong: "0 12px 40px rgba(0, 0, 0, 0.35)",
};

const icons = {
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  bringForward: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
  sendBack: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  rotate: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export default function CanvasEditor({
  images,
  onChange,
  background,
  aspectRatio = 4 / 3,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    startCanvasX: number;
    startCanvasY: number;
  } | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    handle: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startCanvasX: number;
    startCanvasY: number;
  } | null>(null);
  const [showProperties, setShowProperties] = useState(false);

  const selectedImage = images.find((img) => img.id === selectedId);

  // Handle file upload
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newImages: CanvasImage[] = [];
      const maxZIndex = Math.max(0, ...images.map((img) => img.canvasData.zIndex));

      Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          const newImage: CanvasImage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview,
            canvasData: {
              ...defaultCanvasData,
              x: 0.1 + index * 0.05,
              y: 0.1 + index * 0.05,
              zIndex: maxZIndex + index + 1,
            },
          };
          newImages.push(newImage);

          if (newImages.length === files.length) {
            onChange([...images, ...newImages]);
            if (newImages.length > 0) {
              setSelectedId(newImages[newImages.length - 1].id);
              setShowProperties(true);
            }
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [images, onChange]
  );

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, imageId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const image = images.find((img) => img.id === imageId);
      if (!image) return;

      setSelectedId(imageId);
      setDragging({
        id: imageId,
        startX: e.clientX,
        startY: e.clientY,
        startCanvasX: image.canvasData.x,
        startCanvasY: image.canvasData.y,
      });
    },
    [images]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, imageId: string, handle: string) => {
      e.preventDefault();
      e.stopPropagation();

      const image = images.find((img) => img.id === imageId);
      if (!image) return;

      setResizing({
        id: imageId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: image.canvasData.width,
        startHeight: image.canvasData.height,
        startCanvasX: image.canvasData.x,
        startCanvasY: image.canvasData.y,
      });
    },
    [images]
  );

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();

      if (dragging) {
        const deltaX = (e.clientX - dragging.startX) / rect.width;
        const deltaY = (e.clientY - dragging.startY) / rect.height;

        const newX = Math.max(0, Math.min(1, dragging.startCanvasX + deltaX));
        const newY = Math.max(0, Math.min(1, dragging.startCanvasY + deltaY));

        onChange(
          images.map((img) =>
            img.id === dragging.id
              ? { ...img, canvasData: { ...img.canvasData, x: newX, y: newY } }
              : img
          )
        );
      }

      if (resizing) {
        const deltaX = (e.clientX - resizing.startX) / rect.width;
        const deltaY = (e.clientY - resizing.startY) / rect.height;

        let newWidth = resizing.startWidth;
        let newHeight = resizing.startHeight;
        let newX = resizing.startCanvasX;
        let newY = resizing.startCanvasY;

        const handle = resizing.handle;

        // Handle resize based on corner/edge
        if (handle.includes("e")) {
          newWidth = Math.max(0.1, Math.min(1 - newX, resizing.startWidth + deltaX));
        }
        if (handle.includes("w")) {
          const widthChange = deltaX;
          newWidth = Math.max(0.1, resizing.startWidth - widthChange);
          newX = Math.max(0, resizing.startCanvasX + widthChange);
        }
        if (handle.includes("s")) {
          newHeight = Math.max(0.1, Math.min(1 - newY, resizing.startHeight + deltaY));
        }
        if (handle.includes("n")) {
          const heightChange = deltaY;
          newHeight = Math.max(0.1, resizing.startHeight - heightChange);
          newY = Math.max(0, resizing.startCanvasY + heightChange);
        }

        // Maintain aspect ratio when holding Shift
        if (e.shiftKey && (handle === "se" || handle === "sw" || handle === "ne" || handle === "nw")) {
          const ratio = resizing.startWidth / resizing.startHeight;
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / ratio;
          } else {
            newWidth = newHeight * ratio;
          }
        }

        onChange(
          images.map((img) =>
            img.id === resizing.id
              ? {
                  ...img,
                  canvasData: {
                    ...img.canvasData,
                    width: newWidth,
                    height: newHeight,
                    x: newX,
                    y: newY,
                  },
                }
              : img
          )
        );
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };

    if (dragging || resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, resizing, images, onChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;

      const image = images.find((img) => img.id === selectedId);
      if (!image) return;

      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange(images.filter((img) => img.id !== selectedId));
        setSelectedId(null);
      }

      // Arrow keys for nudging
      const nudgeAmount = e.shiftKey ? 0.05 : 0.01;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(
          images.map((img) =>
            img.id === selectedId
              ? { ...img, canvasData: { ...img.canvasData, x: Math.max(0, img.canvasData.x - nudgeAmount) } }
              : img
          )
        );
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onChange(
          images.map((img) =>
            img.id === selectedId
              ? { ...img, canvasData: { ...img.canvasData, x: Math.min(1, img.canvasData.x + nudgeAmount) } }
              : img
          )
        );
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onChange(
          images.map((img) =>
            img.id === selectedId
              ? { ...img, canvasData: { ...img.canvasData, y: Math.max(0, img.canvasData.y - nudgeAmount) } }
              : img
          )
        );
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onChange(
          images.map((img) =>
            img.id === selectedId
              ? { ...img, canvasData: { ...img.canvasData, y: Math.min(1, img.canvasData.y + nudgeAmount) } }
              : img
          )
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, images, onChange]);

  // Layer controls
  const bringForward = (imageId: string) => {
    const maxZ = Math.max(...images.map((img) => img.canvasData.zIndex));
    onChange(
      images.map((img) =>
        img.id === imageId
          ? { ...img, canvasData: { ...img.canvasData, zIndex: maxZ + 1 } }
          : img
      )
    );
  };

  const sendBack = (imageId: string) => {
    const minZ = Math.min(...images.map((img) => img.canvasData.zIndex));
    onChange(
      images.map((img) =>
        img.id === imageId
          ? { ...img, canvasData: { ...img.canvasData, zIndex: minZ - 1 } }
          : img
      )
    );
  };

  const deleteImage = (imageId: string) => {
    onChange(images.filter((img) => img.id !== imageId));
    if (selectedId === imageId) {
      setSelectedId(null);
    }
  };

  const updateImageProperty = (
    imageId: string,
    property: keyof CanvasData,
    value: number | string
  ) => {
    onChange(
      images.map((img) =>
        img.id === imageId
          ? { ...img, canvasData: { ...img.canvasData, [property]: value } }
          : img
      )
    );
  };

  // Get background style
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!background) return { backgroundColor: "#f5f5f5" };

    if (background.type === "solid") {
      return { backgroundColor: background.value };
    }
    if (background.type === "gradient") {
      return { background: background.value };
    }
    if (background.type === "pattern") {
      return {
        background: background.value,
        backgroundSize: background.value.includes("dots") ? "20px 20px" :
                       background.value.includes("grid") ? "20px 20px" :
                       background.value.includes("notebook") ? "100% 24px" : "auto"
      };
    }
    if (background.type === "image" && background.imageUrl) {
      return {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: background.opacity ?? 1,
        filter: background.blur ? `blur(${background.blur}px)` : undefined,
      };
    }
    return { backgroundColor: "#f5f5f5" };
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium shadow-lg shadow-purple-primary/30 hover:shadow-xl hover:shadow-purple-primary/40 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
        </div>

        {selectedId && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => bringForward(selectedId)}
              className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center text-muted transition-colors"
              title="Bring Forward"
            >
              {icons.bringForward}
            </button>
            <button
              onClick={() => sendBack(selectedId)}
              className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center text-muted transition-colors"
              title="Send Back"
            >
              {icons.sendBack}
            </button>
            <button
              onClick={() => setShowProperties(!showProperties)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                showProperties ? "bg-purple-primary text-white" : "hover:bg-black/5 text-muted"
              }`}
              title="Properties"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
            <button
              onClick={() => deleteImage(selectedId)}
              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors"
              title="Delete"
            >
              {icons.trash}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative rounded-2xl overflow-hidden border border-black/10 cursor-crosshair"
          style={{
            aspectRatio: aspectRatio,
            ...getBackgroundStyle(),
          }}
          onClick={() => setSelectedId(null)}
        >
          {images.length === 0 && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center text-muted/50 pointer-events-none"
            >
              {icons.upload}
              <p className="mt-2 font-ui text-sm">Drop images here or click &quot;Add Image&quot;</p>
            </div>
          )}

          {/* Render images sorted by zIndex */}
          {images
            .sort((a, b) => a.canvasData.zIndex - b.canvasData.zIndex)
            .map((image) => {
              const { x, y, width, height, rotation, borderRadius, borderWidth, borderColor, shadow } =
                image.canvasData;
              const isSelected = selectedId === image.id;

              return (
                <div
                  key={image.id}
                  className={`absolute cursor-move ${isSelected ? "ring-2 ring-purple-primary" : ""}`}
                  style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    width: `${width * 100}%`,
                    height: `${height * 100}%`,
                    transform: `rotate(${rotation}deg)`,
                    zIndex: image.canvasData.zIndex,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, image.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(image.id);
                  }}
                >
                  <img
                    src={image.preview}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      borderRadius: `${borderRadius}px`,
                      border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : undefined,
                      boxShadow: shadowStyles[shadow],
                    }}
                    draggable={false}
                  />

                  {/* Resize handles */}
                  {isSelected && (
                    <>
                      {/* Corners */}
                      <div
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-nw-resize"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "nw")}
                      />
                      <div
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-ne-resize"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "ne")}
                      />
                      <div
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-sw-resize"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "sw")}
                      />
                      <div
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-se-resize"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "se")}
                      />
                      {/* Edges */}
                      <div
                        className="absolute top-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-w-resize -translate-y-1/2"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "w")}
                      />
                      <div
                        className="absolute top-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-e-resize -translate-y-1/2"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "e")}
                      />
                      <div
                        className="absolute -top-1.5 left-1/2 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-n-resize -translate-x-1/2"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "n")}
                      />
                      <div
                        className="absolute -bottom-1.5 left-1/2 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-s-resize -translate-x-1/2"
                        onMouseDown={(e) => handleResizeStart(e, image.id, "s")}
                      />
                    </>
                  )}
                </div>
              );
            })}
        </div>

        {/* Properties Panel */}
        {showProperties && selectedImage && (
          <div className="w-64 p-4 bg-white rounded-2xl border border-black/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-ui text-sm font-semibold text-ink">Properties</h3>
              <button
                onClick={() => setShowProperties(false)}
                className="w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center text-muted"
              >
                {icons.close}
              </button>
            </div>

            {/* Border Radius */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-ui text-xs text-muted">Border Radius</label>
                <span className="font-ui text-xs text-ink">{selectedImage.canvasData.borderRadius}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={selectedImage.canvasData.borderRadius}
                onChange={(e) => updateImageProperty(selectedId!, "borderRadius", parseInt(e.target.value))}
                className="w-full accent-purple-primary"
              />
            </div>

            {/* Border Width */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-ui text-xs text-muted">Border</label>
                <span className="font-ui text-xs text-ink">{selectedImage.canvasData.borderWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={selectedImage.canvasData.borderWidth}
                onChange={(e) => updateImageProperty(selectedId!, "borderWidth", parseInt(e.target.value))}
                className="w-full accent-purple-primary"
              />
            </div>

            {/* Border Color */}
            {selectedImage.canvasData.borderWidth > 0 && (
              <div>
                <label className="font-ui text-xs text-muted mb-1.5 block">Border Color</label>
                <input
                  type="color"
                  value={selectedImage.canvasData.borderColor}
                  onChange={(e) => updateImageProperty(selectedId!, "borderColor", e.target.value)}
                  className="w-full h-8 rounded-lg cursor-pointer"
                />
              </div>
            )}

            {/* Shadow */}
            <div>
              <label className="font-ui text-xs text-muted mb-1.5 block">Shadow</label>
              <div className="grid grid-cols-4 gap-1">
                {(["none", "soft", "medium", "strong"] as ShadowStyle[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateImageProperty(selectedId!, "shadow", s)}
                    className={`px-2 py-1.5 rounded-lg font-ui text-xs capitalize transition-colors ${
                      selectedImage.canvasData.shadow === s
                        ? "bg-purple-primary text-white"
                        : "bg-gray-100 text-muted hover:bg-gray-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-ui text-xs text-muted">Rotation</label>
                <span className="font-ui text-xs text-ink">{selectedImage.canvasData.rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={selectedImage.canvasData.rotation}
                onChange={(e) => updateImageProperty(selectedId!, "rotation", parseInt(e.target.value))}
                className="w-full accent-purple-primary"
              />
            </div>

            {/* Size Info */}
            <div className="pt-2 border-t border-black/5">
              <p className="font-ui text-xs text-muted">
                Size: {Math.round(selectedImage.canvasData.width * 100)}% × {Math.round(selectedImage.canvasData.height * 100)}%
              </p>
              <p className="font-ui text-xs text-muted mt-1">
                Position: {Math.round(selectedImage.canvasData.x * 100)}%, {Math.round(selectedImage.canvasData.y * 100)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Help text */}
      <p className="font-ui text-xs text-muted text-center">
        Drag images to position. Use corners to resize (hold Shift for aspect ratio). Arrow keys to nudge. Delete key to remove.
      </p>
    </div>
  );
}
