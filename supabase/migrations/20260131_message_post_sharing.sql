-- Add shared_post_id column to messages table for sharing posts via DM
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_messages_shared_post_id ON messages(shared_post_id) WHERE shared_post_id IS NOT NULL;

-- Update message_type constraint to include 'post_share'
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%message_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE messages DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
CHECK (message_type = ANY (ARRAY['text'::text, 'voice'::text, 'media'::text, 'post_share'::text]));

-- Comment for documentation
COMMENT ON COLUMN messages.shared_post_id IS 'Reference to a shared post when message_type is post_share';
