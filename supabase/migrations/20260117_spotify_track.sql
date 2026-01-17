-- Add Spotify track column to posts table
-- Stores track data as JSONB for flexibility

ALTER TABLE posts ADD COLUMN IF NOT EXISTS spotify_track JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN posts.spotify_track IS 'Spotify track data: {id, name, artist, album, albumArt, previewUrl, externalUrl}';

-- Create index for posts with spotify tracks (for potential filtering)
CREATE INDEX IF NOT EXISTS idx_posts_has_spotify ON posts ((spotify_track IS NOT NULL)) WHERE spotify_track IS NOT NULL;
