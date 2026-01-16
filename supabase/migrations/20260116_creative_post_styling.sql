-- Creative Post Styling Migration
-- Adds support for backgrounds, canvas positioning, location, and journal metadata

-- Add styling column to posts (JSONB for flexible styling options)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS styling JSONB DEFAULT NULL;
-- Example: {"background": {"type": "gradient", "value": "linear-gradient(135deg, #8e44ad, #ff007f)"}, "textAlignment": "center", "lineSpacing": "relaxed", "dropCap": true}

-- Add location column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_location TEXT DEFAULT NULL;

-- Add metadata column to posts (for journal-specific data like weather, mood)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
-- Example: {"weather": "cloudy", "temperature": "15°C", "mood": "reflective", "timeOfDay": "evening"}

-- Add canvas positioning data to post_media
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS canvas_data JSONB DEFAULT NULL;
-- Example: {"x": 0.25, "y": 0.15, "width": 0.5, "height": 0.4, "rotation": 0, "zIndex": 1, "borderRadius": 8, "borderWidth": 2, "borderColor": "#fff", "shadow": "soft"}

-- Create backgrounds preset table for system-provided backgrounds
CREATE TABLE IF NOT EXISTS post_backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('solid', 'gradient', 'pattern', 'texture')),
  value TEXT NOT NULL,
  preview_url TEXT,
  category TEXT DEFAULT 'general',
  is_system BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on post_backgrounds
ALTER TABLE post_backgrounds ENABLE ROW LEVEL SECURITY;

-- Allow all users to read system backgrounds
CREATE POLICY "Anyone can view system backgrounds" ON post_backgrounds
  FOR SELECT USING (is_system = true);

-- Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_post_backgrounds_category ON post_backgrounds(category);

-- Seed with beautiful default backgrounds
INSERT INTO post_backgrounds (name, type, value, category, sort_order) VALUES
  -- Solid Colors - Poetry
  ('Ink', 'solid', '#1e1e1e', 'poetry', 1),
  ('Parchment', 'solid', '#f5f0e6', 'poetry', 2),
  ('Midnight Blue', 'solid', '#1a1a2e', 'poetry', 3),
  ('Soft Lavender', 'solid', '#e6e6fa', 'poetry', 4),

  -- Solid Colors - Journal
  ('Warm Cream', 'solid', '#fdf8f3', 'journal', 5),
  ('Sage', 'solid', '#9dc183', 'journal', 6),
  ('Dusty Rose', 'solid', '#dcb8b0', 'journal', 7),
  ('Sky Blue', 'solid', '#87ceeb', 'journal', 8),

  -- Gradients - Poetry
  ('Purple Dream', 'gradient', 'linear-gradient(135deg, #8e44ad 0%, #c39bd3 100%)', 'poetry', 10),
  ('Twilight', 'gradient', 'linear-gradient(135deg, #1a1a2e 0%, #4a4a6a 100%)', 'poetry', 11),
  ('Rose Gold', 'gradient', 'linear-gradient(135deg, #b76e79 0%, #eacda3 100%)', 'poetry', 12),

  -- Gradients - Journal
  ('Morning Mist', 'gradient', 'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)', 'journal', 13),
  ('Sunset', 'gradient', 'linear-gradient(135deg, #ff9f43 0%, #ff007f 100%)', 'journal', 14),
  ('Ocean', 'gradient', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'journal', 15),
  ('Forest', 'gradient', 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)', 'journal', 16),

  -- Gradients - Minimal
  ('Soft White', 'gradient', 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)', 'minimal', 17),
  ('Pearl', 'gradient', 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', 'minimal', 18),

  -- Patterns
  ('Paper Texture', 'pattern', 'paper-vintage', 'journal', 20),
  ('Linen', 'pattern', 'linen', 'journal', 21),
  ('Subtle Dots', 'pattern', 'dots-soft', 'minimal', 22),
  ('Grid', 'pattern', 'grid-light', 'minimal', 23),
  ('Watercolor Wash', 'pattern', 'watercolor', 'poetry', 24);
