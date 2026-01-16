"use client";

import React, { useState, useRef, useCallback } from "react";
import { PostBackground, ShadowStyle } from "@/lib/types";

export interface CanvasTextBlock {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

export interface CanvasImageBlock {
  id: string;
  file?: File;
  preview: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  shadow: ShadowStyle;
}

interface CanvasEditorProps {
  textBlocks: CanvasTextBlock[];
  onTextBlocksChange: (blocks: CanvasTextBlock[]) => void;
  imageBlocks: CanvasImageBlock[];
  onImageBlocksChange: (blocks: CanvasImageBlock[]) => void;
  background?: PostBackground | null;
}

export default function CanvasEditor({
  textBlocks,
  onTextBlocksChange,
  imageBlocks,
  onImageBlocksChange,
  background,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; type: 'text' | 'image'; startX: number; startY: number; elemX: number; elemY: number } | null>(null);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get background style
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!background) return { backgroundColor: "#fafafa" };
    if (background.type === "solid") return { backgroundColor: background.value };
    if (background.type === "gradient") return { background: background.value };
    if (background.type === "image" && background.imageUrl) {
      return {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: "#fafafa" };
  };

  // Add text block on double click
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newBlock: CanvasTextBlock = {
      id: generateId(),
      content: "",
      x,
      y,
      width: 40,
      fontSize: 18,
    };
    onTextBlocksChange([...textBlocks, newBlock]);
    setSelectedTextId(newBlock.id);
    setSelectedImageId(null);
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newImage: CanvasImageBlock = {
          id: generateId(),
          file,
          preview: ev.target?.result as string,
          x: 10 + Math.random() * 20,
          y: 10 + Math.random() * 20,
          width: 30,
          height: 30,
          borderRadius: 8,
          shadow: "soft",
        };
        onImageBlocksChange([...imageBlocks, newImage]);
        setSelectedImageId(newImage.id);
        setSelectedTextId(null);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Start dragging
  const handleDragStart = (e: React.MouseEvent, id: string, type: 'text' | 'image') => {
    e.stopPropagation();
    const item = type === 'text'
      ? textBlocks.find(b => b.id === id)
      : imageBlocks.find(b => b.id === id);
    if (!item) return;

    setDragging({ id, type, startX: e.clientX, startY: e.clientY, elemX: item.x, elemY: item.y });
    if (type === 'text') {
      setSelectedTextId(id);
      setSelectedImageId(null);
    } else {
      setSelectedImageId(id);
      setSelectedTextId(null);
    }
  };

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragging.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragging.startY) / rect.height) * 100;
    const newX = Math.max(0, Math.min(90, dragging.elemX + deltaX));
    const newY = Math.max(0, Math.min(90, dragging.elemY + deltaY));

    if (dragging.type === 'text') {
      onTextBlocksChange(textBlocks.map(b => b.id === dragging.id ? { ...b, x: newX, y: newY } : b));
    } else {
      onImageBlocksChange(imageBlocks.map(b => b.id === dragging.id ? { ...b, x: newX, y: newY } : b));
    }
  }, [dragging, textBlocks, imageBlocks, onTextBlocksChange, onImageBlocksChange]);

  // Stop dragging
  const handleMouseUp = () => setDragging(null);

  // Delete selected item
  const handleDelete = () => {
    if (selectedTextId) {
      onTextBlocksChange(textBlocks.filter(b => b.id !== selectedTextId));
      setSelectedTextId(null);
    }
    if (selectedImageId) {
      onImageBlocksChange(imageBlocks.filter(b => b.id !== selectedImageId));
      setSelectedImageId(null);
    }
  };

  // Update text content
  const handleTextChange = (id: string, content: string) => {
    onTextBlocksChange(textBlocks.map(b => b.id === id ? { ...b, content } : b));
  };

  // Update text width
  const handleTextWidthChange = (id: string, width: number) => {
    onTextBlocksChange(textBlocks.map(b => b.id === id ? { ...b, width } : b));
  };

  // Update image size
  const handleImageSizeChange = (id: string, width: number, height: number) => {
    onImageBlocksChange(imageBlocks.map(b => b.id === id ? { ...b, width, height } : b));
  };

  const selectedText = textBlocks.find(b => b.id === selectedTextId);
  const selectedImage = imageBlocks.find(b => b.id === selectedImageId);

  return (
    <div className="space-y-4">
      {/* Simple Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Add Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {(selectedTextId || selectedImageId) && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-500 font-ui text-sm hover:bg-red-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}

        {selectedText && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-ui text-xs text-muted">Width:</span>
            <input
              type="range"
              min="20"
              max="80"
              value={selectedText.width}
              onChange={(e) => handleTextWidthChange(selectedTextId!, parseInt(e.target.value))}
              className="w-24 accent-purple-primary"
            />
          </div>
        )}

        {selectedImage && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-ui text-xs text-muted">Size:</span>
            <input
              type="range"
              min="15"
              max="60"
              value={selectedImage.width}
              onChange={(e) => {
                const size = parseInt(e.target.value);
                handleImageSizeChange(selectedImageId!, size, size);
              }}
              className="w-24 accent-purple-primary"
            />
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="relative w-full rounded-2xl overflow-hidden border-2 border-dashed border-purple-primary/30 cursor-crosshair"
        style={{
          minHeight: "450px",
          ...getBackgroundStyle(),
        }}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => {
          setSelectedTextId(null);
          setSelectedImageId(null);
        }}
      >
        {/* Empty state */}
        {textBlocks.length === 0 && imageBlocks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-primary/40 pointer-events-none">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="font-ui text-base font-medium">Double-click anywhere to start writing</p>
            <p className="font-ui text-sm mt-1">or add images using the button above</p>
          </div>
        )}

        {/* Render text blocks */}
        {textBlocks.map((block) => (
          <div
            key={block.id}
            className={`absolute cursor-move ${selectedTextId === block.id ? 'ring-2 ring-purple-primary ring-offset-2' : ''}`}
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.width}%`,
            }}
            onMouseDown={(e) => handleDragStart(e, block.id, 'text')}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTextId(block.id);
              setSelectedImageId(null);
            }}
          >
            <textarea
              value={block.content}
              onChange={(e) => handleTextChange(block.id, e.target.value)}
              placeholder="Write here..."
              className="w-full bg-transparent border-none outline-none resize-none font-body text-ink p-2"
              style={{ fontSize: `${block.fontSize}px`, minHeight: '60px' }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        ))}

        {/* Render image blocks */}
        {imageBlocks.map((block) => (
          <div
            key={block.id}
            className={`absolute cursor-move ${selectedImageId === block.id ? 'ring-2 ring-purple-primary ring-offset-2' : ''}`}
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.width}%`,
            }}
            onMouseDown={(e) => handleDragStart(e, block.id, 'image')}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImageId(block.id);
              setSelectedTextId(null);
            }}
          >
            <img
              src={block.preview}
              alt=""
              className="w-full h-auto object-cover pointer-events-none"
              style={{
                borderRadius: `${block.borderRadius}px`,
                boxShadow: block.shadow === 'soft' ? '0 4px 20px rgba(0,0,0,0.1)' :
                           block.shadow === 'medium' ? '0 8px 30px rgba(0,0,0,0.2)' :
                           block.shadow === 'strong' ? '0 12px 40px rgba(0,0,0,0.3)' : 'none',
              }}
              draggable={false}
            />
          </div>
        ))}
      </div>

      <p className="font-ui text-xs text-muted text-center">
        Double-click to add text. Drag to move items. Click to select, then delete or resize.
      </p>
    </div>
  );
}
