ALTER TABLE venue_layouts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS venue_layouts_active_by_venue
  ON venue_layouts (venue_id, is_default DESC, updated_at DESC)
  WHERE archived_at IS NULL;
