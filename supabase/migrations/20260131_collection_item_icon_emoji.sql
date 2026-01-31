-- Add icon_emoji column to collection_items table
-- This allows items to have their own icon/emoji, similar to collections

ALTER TABLE collection_items
ADD COLUMN IF NOT EXISTS icon_emoji TEXT;

-- Add comment for documentation
COMMENT ON COLUMN collection_items.icon_emoji IS 'Icon emoji code, icon:name format for SVG icons, or url:path for custom images';
