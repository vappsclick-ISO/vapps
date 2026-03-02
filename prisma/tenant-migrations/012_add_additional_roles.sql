-- Additional (custom) roles, e.g. Auditor. Extensible for future client-specific roles.
CREATE TABLE IF NOT EXISTS additional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Assign additional roles to users (many-to-many).
CREATE TABLE IF NOT EXISTS user_additional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  additional_role_id uuid NOT NULL REFERENCES additional_roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, additional_role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_additional_roles_user_id ON user_additional_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_additional_roles_role_id ON user_additional_roles(additional_role_id);

-- Store which additional roles are assigned via invitation (for use on accept).
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS additional_role_ids uuid[] DEFAULT '{}';

-- Seed default "Auditor" role (idempotent: insert only if not exists).
INSERT INTO additional_roles (id, name, description, is_active)
SELECT gen_random_uuid(), 'Auditor', 'Can view and audit processes and reports without making changes.', true
WHERE NOT EXISTS (SELECT 1 FROM additional_roles WHERE name = 'Auditor');
