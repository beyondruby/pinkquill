-- Add shared_post_id column to messages table for sharing posts via DM
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_messages_shared_post_id ON messages(shared_post_id) WHERE shared_post_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN messages.shared_post_id IS 'Reference to a shared post when message_type is post_share';
