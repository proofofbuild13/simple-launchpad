-- =====================================================
-- PLATFORM UPDATE MIGRATION
-- 1. Global currency fields (default USD)
-- 2. Project invitations table & workflow
-- 3. Saved builders table (already exists, ensure RLS)
-- 4. Notification badge system fields
-- =====================================================

-- ===================== UPDATE 1: CURRENCY =====================

-- Add currency field to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to contracts
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to contract_milestones
ALTER TABLE contract_milestones ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to payment_records
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to commission_invoices
ALTER TABLE commission_invoices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency field to commission_payments
ALTER TABLE commission_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';


-- ===================== UPDATE 2: PROJECT INVITATIONS =====================

CREATE TABLE IF NOT EXISTS project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL,
  builder_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','viewed','accepted','declined','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_invitations_builder ON project_invitations(builder_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_founder ON project_invitations(founder_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);

-- RLS
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invitations"
  ON project_invitations FOR SELECT
  USING (auth.uid() = founder_id OR auth.uid() = builder_id);

CREATE POLICY "Founders can create invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (auth.uid() = founder_id);

CREATE POLICY "Builders can update invitation status"
  ON project_invitations FOR UPDATE
  USING (auth.uid() = builder_id)
  WITH CHECK (auth.uid() = builder_id);


-- ===================== UPDATE 3: SAVED BUILDERS =====================
-- Table already exists. Ensure RLS policies.

ALTER TABLE saved_builders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_builders' AND policyname = 'Founders manage saved builders'
  ) THEN
    CREATE POLICY "Founders manage saved builders"
      ON saved_builders FOR ALL
      USING (auth.uid() = founder_id)
      WITH CHECK (auth.uid() = founder_id);
  END IF;
END $$;


-- ===================== UPDATE 4: NOTIFICATIONS =====================

-- Add missing notification fields
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_entity_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_entity_id uuid;

-- Backfill: set is_read from existing 'read' column if it exists
UPDATE notifications SET is_read = COALESCE(read, false) WHERE is_read = false AND read = true;

-- Copy type to notification_type for existing rows
UPDATE notifications SET notification_type = type WHERE notification_type IS NULL AND type IS NOT NULL;

-- Index for fast unread count
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
