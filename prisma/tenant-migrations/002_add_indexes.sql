-- Add indexes for performance optimization
-- These indexes improve lookup performance for site_users and process_users

-- Index on site_users for user_id lookups
CREATE INDEX IF NOT EXISTS idx_site_users_user_id ON site_users(user_id);

-- Index on process_users for user_id lookups
CREATE INDEX IF NOT EXISTS idx_process_users_user_id ON process_users(user_id);

-- Index on invitations for token lookups (already unique, but explicit index for clarity)
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- Index on invitations for status and expiration checks
CREATE INDEX IF NOT EXISTS idx_invitations_status_expires ON invitations(status, expires_at);

