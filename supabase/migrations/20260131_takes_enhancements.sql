-- Takes Feature Enhancements
-- Adds: thumbnails, aspect ratios, sounds system, effects metadata

-- ============================================
-- 1. SOUNDS TABLE (for audio/music library)
-- ============================================
CREATE TABLE IF NOT EXISTS sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  artist TEXT,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration INTEGER NOT NULL, -- in seconds
  genre TEXT,
  is_original BOOLEAN DEFAULT false,
  original_take_id UUID REFERENCES takes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  use_count INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sounds_trending ON sounds(is_trending, use_count DESC) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_sounds_genre ON sounds(genre);
CREATE INDEX IF NOT EXISTS idx_sounds_created_by ON sounds(created_by);
CREATE INDEX IF NOT EXISTS idx_sounds_original_take ON sounds(original_take_id);

-- Enable RLS
ALTER TABLE sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sounds" ON sounds FOR SELECT USING (true);
CREATE POLICY "Users can create sounds" ON sounds FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their sounds" ON sounds FOR UPDATE USING (auth.uid() = created_by);

-- ============================================
-- 2. ADD NEW COLUMNS TO TAKES TABLE
-- ============================================

-- Aspect ratio for the video (default 9:16 for vertical)
ALTER TABLE takes ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '9:16'
  CHECK (aspect_ratio IN ('9:16', '16:9', '4:5', '1:1', '4:3'));

-- Video effects/filters applied
ALTER TABLE takes ADD COLUMN IF NOT EXISTS effects JSONB DEFAULT '[]'::jsonb;
-- Example: [{"type": "filter", "name": "vintage"}, {"type": "speed", "value": 1.5}]

-- Text overlays on video
ALTER TABLE takes ADD COLUMN IF NOT EXISTS text_overlays JSONB DEFAULT '[]'::jsonb;
-- Example: [{"text": "Hello!", "x": 50, "y": 100, "font": "bold", "color": "#fff", "startTime": 0, "endTime": 5}]

-- Playback speed (0.5x, 1x, 1.5x, 2x)
ALTER TABLE takes ADD COLUMN IF NOT EXISTS playback_speed NUMERIC(3,2) DEFAULT 1.0
  CHECK (playback_speed IN (0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0));

-- Allow original sound to be extracted as reusable sound
ALTER TABLE takes ADD COLUMN IF NOT EXISTS allow_sound_use BOOLEAN DEFAULT true;

-- Link to the sound used (if using existing sound)
-- Note: sound_id column may already exist, this ensures it has proper reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'takes' AND column_name = 'sound_id'
  ) THEN
    ALTER TABLE takes ADD COLUMN sound_id UUID REFERENCES sounds(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Sound start time (where in the sound to begin)
ALTER TABLE takes ADD COLUMN IF NOT EXISTS sound_start_time INTEGER DEFAULT 0;

-- Original audio volume (0-100, when using external sound)
ALTER TABLE takes ADD COLUMN IF NOT EXISTS original_audio_volume INTEGER DEFAULT 100
  CHECK (original_audio_volume >= 0 AND original_audio_volume <= 100);

-- Added sound volume (0-100)
ALTER TABLE takes ADD COLUMN IF NOT EXISTS added_sound_volume INTEGER DEFAULT 100
  CHECK (added_sound_volume >= 0 AND added_sound_volume <= 100);

-- ============================================
-- 3. SOUND FAVORITES (users can save sounds)
-- ============================================
CREATE TABLE IF NOT EXISTS sound_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sound_id UUID NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sound_id)
);

CREATE INDEX IF NOT EXISTS idx_sound_favorites_user ON sound_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_sound_favorites_sound ON sound_favorites(sound_id);

ALTER TABLE sound_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their favorites" ON sound_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON sound_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON sound_favorites FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. FUNCTION TO INCREMENT SOUND USE COUNT
-- ============================================
CREATE OR REPLACE FUNCTION increment_sound_use_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sound_id IS NOT NULL THEN
    UPDATE sounds SET use_count = use_count + 1 WHERE id = NEW.sound_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment when a take uses a sound
DROP TRIGGER IF EXISTS on_take_uses_sound ON takes;
CREATE TRIGGER on_take_uses_sound
  AFTER INSERT ON takes
  FOR EACH ROW
  EXECUTE FUNCTION increment_sound_use_count();

-- ============================================
-- 5. UPDATE TRENDING SOUNDS (run periodically)
-- ============================================
CREATE OR REPLACE FUNCTION update_trending_sounds()
RETURNS void AS $$
BEGIN
  -- Reset all trending flags
  UPDATE sounds SET is_trending = false;

  -- Mark top 20 most used sounds in last 7 days as trending
  UPDATE sounds SET is_trending = true
  WHERE id IN (
    SELECT s.id
    FROM sounds s
    JOIN takes t ON t.sound_id = s.id
    WHERE t.created_at > NOW() - INTERVAL '7 days'
    GROUP BY s.id
    ORDER BY COUNT(*) DESC
    LIMIT 20
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. INDEXES FOR NEW COLUMNS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_takes_sound_id ON takes(sound_id) WHERE sound_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_takes_aspect_ratio ON takes(aspect_ratio);

-- ============================================
-- 7. COMMENTS
-- ============================================
COMMENT ON COLUMN takes.aspect_ratio IS 'Video aspect ratio: 9:16 (vertical), 16:9 (horizontal), 4:5, 1:1, 4:3';
COMMENT ON COLUMN takes.effects IS 'JSON array of applied effects [{type, name, value}]';
COMMENT ON COLUMN takes.text_overlays IS 'JSON array of text overlays [{text, x, y, font, color, startTime, endTime}]';
COMMENT ON COLUMN takes.playback_speed IS 'Playback speed multiplier: 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0';
COMMENT ON COLUMN takes.allow_sound_use IS 'Whether others can use this take''s original audio as a sound';
COMMENT ON COLUMN takes.sound_start_time IS 'Start time in seconds for the added sound';
COMMENT ON COLUMN takes.original_audio_volume IS 'Volume of original video audio (0-100)';
COMMENT ON COLUMN takes.added_sound_volume IS 'Volume of added sound/music (0-100)';
COMMENT ON TABLE sounds IS 'Audio/music library for takes - includes original sounds and music';
COMMENT ON TABLE sound_favorites IS 'User saved/favorited sounds';
