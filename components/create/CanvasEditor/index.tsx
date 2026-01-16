"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { CanvasElement, CanvasTextStyle, ShadowStyle, PostBackground, TextAlignment } from "@/lib/types";

// Legacy export for backward compatibility
export interface CanvasImage {
  id: string;
  file?: File;
  preview: string;
  mediaUrl?: string;
  canvasData: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
    shadow: ShadowStyle;
  };
}

interface CanvasEditorProps {
  elements: CanvasElement[];
  onChange: (elements: CanvasElement[]) => void;
  background?: PostBackground | null;
  aspectRatio?: number;
  // Legacy support
  images?: CanvasImage[];
  onImagesChange?: (images: CanvasImage[]) => void;
}

const defaultTextStyle: CanvasTextStyle = {
  fontFamily: "'Crimson Pro', serif",
  fontSize: 18,
  fontWeight: "normal",
  fontStyle: "normal",
  textAlign: "left",
  color: "#1e1e1e",
  lineHeight: 1.6,
};

const shadowStyles: Record<ShadowStyle, string> = {
  none: "none",
  soft: "0 4px 20px rgba(0, 0, 0, 0.1)",
  medium: "0 8px 30px rgba(0, 0, 0, 0.2)",
  strong: "0 12px 40px rgba(0, 0, 0, 0.35)",
};

const fontOptions = [
  { id: "crimson", label: "Crimson Pro", family: "'Crimson Pro', serif" },
  { id: "libre", label: "Libre Baskerville", family: "'Libre Baskerville', serif" },
  { id: "playfair", label: "Playfair Display", family: "'Playfair Display', serif" },
  { id: "inter", label: "Inter", family: "'Inter', sans-serif" },
  { id: "josefin", label: "Josefin Sans", family: "'Josefin Sans', sans-serif" },
  { id: "dancing", label: "Dancing Script", family: "'Dancing Script', cursive" },
  { id: "caveat", label: "Caveat", family: "'Caveat', cursive" },
];

const icons = {
  text: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  image: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
  close: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  bold: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
    </svg>
  ),
  italic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m2 0l-6 16m-2 0h4" />
    </svg>
  ),
  alignLeft: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  ),
  alignCenter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  ),
  alignRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h10M6 18h14" />
    </svg>
  ),
};

export default function CanvasEditor({
  elements,
  onChange,
  background,
  aspectRatio = 4 / 3,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
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

  const selectedElement = elements.find((el) => el.id === selectedId);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add text element
  const addTextElement = useCallback(() => {
    const maxZIndex = Math.max(0, ...elements.map((el) => el.zIndex));
    const newElement: CanvasElement = {
      id: generateId(),
      type: "text",
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.2,
      rotation: 0,
      zIndex: maxZIndex + 1,
      content: "<p>Click to edit text...</p>",
      textStyle: { ...defaultTextStyle },
    };
    onChange([...elements, newElement]);
    setSelectedId(newElement.id);
    setShowProperties(true);
  }, [elements, onChange]);

  // Handle file upload for images
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const maxZIndex = Math.max(0, ...elements.map((el) => el.zIndex));

      Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          const newElement: CanvasElement = {
            id: generateId(),
            type: "image",
            x: 0.1 + index * 0.05,
            y: 0.1 + index * 0.05,
            width: 0.4,
            height: 0.4,
            rotation: 0,
            zIndex: maxZIndex + index + 1,
            imageUrl: preview,
            borderRadius: 8,
            borderWidth: 0,
            borderColor: "#ffffff",
            shadow: "none",
          };
          onChange([...elements, newElement]);
          setSelectedId(newElement.id);
          setShowProperties(true);
        };
        reader.readAsDataURL(file);
      });
    },
    [elements, onChange]
  );

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      if (editingTextId === elementId) return; // Don't drag while editing
      e.preventDefault();
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      setSelectedId(elementId);
      setDragging({
        id: elementId,
        startX: e.clientX,
        startY: e.clientY,
        startCanvasX: element.x,
        startCanvasY: element.y,
      });
    },
    [elements, editingTextId]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, elementId: string, handle: string) => {
      e.preventDefault();
      e.stopPropagation();

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      setResizing({
        id: elementId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: element.width,
        startHeight: element.height,
        startCanvasX: element.x,
        startCanvasY: element.y,
      });
    },
    [elements]
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
          elements.map((el) =>
            el.id === dragging.id ? { ...el, x: newX, y: newY } : el
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

        if (handle.includes("e")) {
          newWidth = Math.max(0.05, Math.min(1 - newX, resizing.startWidth + deltaX));
        }
        if (handle.includes("w")) {
          const widthChange = deltaX;
          newWidth = Math.max(0.05, resizing.startWidth - widthChange);
          newX = Math.max(0, resizing.startCanvasX + widthChange);
        }
        if (handle.includes("s")) {
          newHeight = Math.max(0.05, Math.min(1 - newY, resizing.startHeight + deltaY));
        }
        if (handle.includes("n")) {
          const heightChange = deltaY;
          newHeight = Math.max(0.05, resizing.startHeight - heightChange);
          newY = Math.max(0, resizing.startCanvasY + heightChange);
        }

        onChange(
          elements.map((el) =>
            el.id === resizing.id
              ? { ...el, width: newWidth, height: newHeight, x: newX, y: newY }
              : el
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
  }, [dragging, resizing, elements, onChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || editingTextId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange(elements.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }

      const nudgeAmount = e.shiftKey ? 0.05 : 0.01;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(
          elements.map((el) =>
            el.id === selectedId ? { ...el, x: Math.max(0, el.x - nudgeAmount) } : el
          )
        );
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onChange(
          elements.map((el) =>
            el.id === selectedId ? { ...el, x: Math.min(1, el.x + nudgeAmount) } : el
          )
        );
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onChange(
          elements.map((el) =>
            el.id === selectedId ? { ...el, y: Math.max(0, el.y - nudgeAmount) } : el
          )
        );
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onChange(
          elements.map((el) =>
            el.id === selectedId ? { ...el, y: Math.min(1, el.y + nudgeAmount) } : el
          )
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingTextId, elements, onChange]);

  // Layer controls
  const bringForward = (elementId: string) => {
    const maxZ = Math.max(...elements.map((el) => el.zIndex));
    onChange(
      elements.map((el) =>
        el.id === elementId ? { ...el, zIndex: maxZ + 1 } : el
      )
    );
  };

  const sendBack = (elementId: string) => {
    const minZ = Math.min(...elements.map((el) => el.zIndex));
    onChange(
      elements.map((el) =>
        el.id === elementId ? { ...el, zIndex: minZ - 1 } : el
      )
    );
  };

  const deleteElement = (elementId: string) => {
    onChange(elements.filter((el) => el.id !== elementId));
    if (selectedId === elementId) setSelectedId(null);
  };

  const updateElement = (elementId: string, updates: Partial<CanvasElement>) => {
    onChange(
      elements.map((el) =>
        el.id === elementId ? { ...el, ...updates } : el
      )
    );
  };

  const updateTextStyle = (elementId: string, styleUpdates: Partial<CanvasTextStyle>) => {
    onChange(
      elements.map((el) =>
        el.id === elementId
          ? { ...el, textStyle: { ...el.textStyle, ...styleUpdates } }
          : el
      )
    );
  };

  // Handle text content change
  const handleTextChange = (elementId: string, content: string) => {
    onChange(
      elements.map((el) =>
        el.id === elementId ? { ...el, content } : el
      )
    );
  };

  // Get background style
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!background) return { backgroundColor: "#fafafa" };

    if (background.type === "solid") return { backgroundColor: background.value };
    if (background.type === "gradient") return { background: background.value };
    if (background.type === "pattern") {
      return {
        background: background.value,
        backgroundSize: background.value.includes("dots") ? "20px 20px" :
                       background.value.includes("grid") ? "20px 20px" : "auto"
      };
    }
    if (background.type === "image" && background.imageUrl) {
      return {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: "#fafafa" };
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={addTextElement}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-ink font-ui text-sm font-medium hover:bg-gray-200 transition-all"
          >
            {icons.text}
            Add Text
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium shadow-lg shadow-purple-primary/30 hover:shadow-xl transition-all"
          >
            {icons.image}
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
              onClick={() => deleteElement(selectedId)}
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
          className="flex-1 relative rounded-2xl overflow-hidden border border-black/10"
          style={{
            aspectRatio: aspectRatio,
            minHeight: "400px",
            ...getBackgroundStyle(),
          }}
          onClick={() => {
            setSelectedId(null);
            setEditingTextId(null);
          }}
        >
          {elements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted/50 pointer-events-none">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="font-ui text-sm">Add text or images to your canvas</p>
              <p className="font-ui text-xs mt-1">Position them freely like a notebook</p>
            </div>
          )}

          {/* Render elements sorted by zIndex */}
          {elements
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((element) => {
              const isSelected = selectedId === element.id;
              const isEditing = editingTextId === element.id;

              return (
                <div
                  key={element.id}
                  className={`absolute ${isEditing ? "" : "cursor-move"} ${
                    isSelected ? "ring-2 ring-purple-primary ring-offset-2" : ""
                  }`}
                  style={{
                    left: `${element.x * 100}%`,
                    top: `${element.y * 100}%`,
                    width: `${element.width * 100}%`,
                    height: `${element.height * 100}%`,
                    transform: `rotate(${element.rotation}deg)`,
                    zIndex: element.zIndex,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, element.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(element.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (element.type === "text") {
                      setEditingTextId(element.id);
                    }
                  }}
                >
                  {element.type === "text" ? (
                    <div
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      className={`w-full h-full overflow-hidden outline-none p-2 ${
                        isEditing ? "cursor-text" : ""
                      }`}
                      style={{
                        fontFamily: element.textStyle?.fontFamily || defaultTextStyle.fontFamily,
                        fontSize: `${element.textStyle?.fontSize || 18}px`,
                        fontWeight: element.textStyle?.fontWeight || "normal",
                        fontStyle: element.textStyle?.fontStyle || "normal",
                        textAlign: element.textStyle?.textAlign || "left",
                        color: element.textStyle?.color || "#1e1e1e",
                        backgroundColor: element.textStyle?.backgroundColor || "transparent",
                        lineHeight: element.textStyle?.lineHeight || 1.6,
                      }}
                      onBlur={(e) => {
                        handleTextChange(element.id, e.currentTarget.innerHTML);
                        setEditingTextId(null);
                      }}
                      dangerouslySetInnerHTML={{ __html: element.content || "" }}
                    />
                  ) : (
                    <img
                      src={element.imageUrl}
                      alt=""
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        borderRadius: `${element.borderRadius || 0}px`,
                        border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor}` : undefined,
                        boxShadow: shadowStyles[element.shadow || "none"],
                      }}
                      draggable={false}
                    />
                  )}

                  {/* Resize handles */}
                  {isSelected && !isEditing && (
                    <>
                      <div
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-nw-resize"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "nw")}
                      />
                      <div
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-ne-resize"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "ne")}
                      />
                      <div
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-sw-resize"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "sw")}
                      />
                      <div
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-se-resize"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "se")}
                      />
                      <div
                        className="absolute top-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-w-resize -translate-y-1/2"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "w")}
                      />
                      <div
                        className="absolute top-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-e-resize -translate-y-1/2"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "e")}
                      />
                      <div
                        className="absolute -top-1.5 left-1/2 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-n-resize -translate-x-1/2"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "n")}
                      />
                      <div
                        className="absolute -bottom-1.5 left-1/2 w-3 h-3 bg-white border-2 border-purple-primary rounded-full cursor-s-resize -translate-x-1/2"
                        onMouseDown={(e) => handleResizeStart(e, element.id, "s")}
                      />
                    </>
                  )}
                </div>
              );
            })}
        </div>

        {/* Properties Panel */}
        {showProperties && selectedElement && (
          <div className="w-64 p-4 bg-white rounded-2xl border border-black/10 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="font-ui text-sm font-semibold text-ink">
                {selectedElement.type === "text" ? "Text Properties" : "Image Properties"}
              </h3>
              <button
                onClick={() => setShowProperties(false)}
                className="w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center text-muted"
              >
                {icons.close}
              </button>
            </div>

            {selectedElement.type === "text" && (
              <>
                {/* Font Family */}
                <div>
                  <label className="font-ui text-xs text-muted mb-1.5 block">Font</label>
                  <select
                    value={selectedElement.textStyle?.fontFamily || defaultTextStyle.fontFamily}
                    onChange={(e) => updateTextStyle(selectedId!, { fontFamily: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-black/10 font-ui text-sm"
                  >
                    {fontOptions.map((font) => (
                      <option key={font.id} value={font.family} style={{ fontFamily: font.family }}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-ui text-xs text-muted">Font Size</label>
                    <span className="font-ui text-xs text-ink">{selectedElement.textStyle?.fontSize || 18}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={selectedElement.textStyle?.fontSize || 18}
                    onChange={(e) => updateTextStyle(selectedId!, { fontSize: parseInt(e.target.value) })}
                    className="w-full accent-purple-primary"
                  />
                </div>

                {/* Style Buttons */}
                <div>
                  <label className="font-ui text-xs text-muted mb-1.5 block">Style</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateTextStyle(selectedId!, {
                        fontWeight: selectedElement.textStyle?.fontWeight === "bold" ? "normal" : "bold"
                      })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        selectedElement.textStyle?.fontWeight === "bold"
                          ? "bg-purple-primary text-white"
                          : "bg-gray-100 text-muted hover:bg-gray-200"
                      }`}
                    >
                      {icons.bold}
                    </button>
                    <button
                      onClick={() => updateTextStyle(selectedId!, {
                        fontStyle: selectedElement.textStyle?.fontStyle === "italic" ? "normal" : "italic"
                      })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        selectedElement.textStyle?.fontStyle === "italic"
                          ? "bg-purple-primary text-white"
                          : "bg-gray-100 text-muted hover:bg-gray-200"
                      }`}
                    >
                      {icons.italic}
                    </button>
                  </div>
                </div>

                {/* Text Alignment */}
                <div>
                  <label className="font-ui text-xs text-muted mb-1.5 block">Alignment</label>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as TextAlignment[]).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateTextStyle(selectedId!, { textAlign: align })}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          selectedElement.textStyle?.textAlign === align
                            ? "bg-purple-primary text-white"
                            : "bg-gray-100 text-muted hover:bg-gray-200"
                        }`}
                      >
                        {icons[`align${align.charAt(0).toUpperCase() + align.slice(1)}` as keyof typeof icons]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Color */}
                <div>
                  <label className="font-ui text-xs text-muted mb-1.5 block">Text Color</label>
                  <input
                    type="color"
                    value={selectedElement.textStyle?.color || "#1e1e1e"}
                    onChange={(e) => updateTextStyle(selectedId!, { color: e.target.value })}
                    className="w-full h-8 rounded-lg cursor-pointer"
                  />
                </div>
              </>
            )}

            {selectedElement.type === "image" && (
              <>
                {/* Border Radius */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-ui text-xs text-muted">Border Radius</label>
                    <span className="font-ui text-xs text-ink">{selectedElement.borderRadius || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={selectedElement.borderRadius || 0}
                    onChange={(e) => updateElement(selectedId!, { borderRadius: parseInt(e.target.value) })}
                    className="w-full accent-purple-primary"
                  />
                </div>

                {/* Border Width */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-ui text-xs text-muted">Border</label>
                    <span className="font-ui text-xs text-ink">{selectedElement.borderWidth || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={selectedElement.borderWidth || 0}
                    onChange={(e) => updateElement(selectedId!, { borderWidth: parseInt(e.target.value) })}
                    className="w-full accent-purple-primary"
                  />
                </div>

                {/* Border Color */}
                {(selectedElement.borderWidth || 0) > 0 && (
                  <div>
                    <label className="font-ui text-xs text-muted mb-1.5 block">Border Color</label>
                    <input
                      type="color"
                      value={selectedElement.borderColor || "#ffffff"}
                      onChange={(e) => updateElement(selectedId!, { borderColor: e.target.value })}
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
                        onClick={() => updateElement(selectedId!, { shadow: s })}
                        className={`px-2 py-1.5 rounded-lg font-ui text-xs capitalize transition-colors ${
                          selectedElement.shadow === s
                            ? "bg-purple-primary text-white"
                            : "bg-gray-100 text-muted hover:bg-gray-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Position Info */}
            <div className="pt-2 border-t border-black/5">
              <p className="font-ui text-xs text-muted">
                Size: {Math.round(selectedElement.width * 100)}% × {Math.round(selectedElement.height * 100)}%
              </p>
              <p className="font-ui text-xs text-muted mt-1">
                Position: {Math.round(selectedElement.x * 100)}%, {Math.round(selectedElement.y * 100)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Help text */}
      <p className="font-ui text-xs text-muted text-center">
        Double-click text to edit. Drag elements to position. Use corners to resize. Arrow keys to nudge. Delete key to remove.
      </p>
    </div>
  );
}
