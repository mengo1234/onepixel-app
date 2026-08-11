ALTER TABLE event_joins ADD COLUMN IF NOT EXISTS candidate_zone_id TEXT;
ALTER TABLE event_joins ADD COLUMN IF NOT EXISTS candidate_since TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_once_idx
  ON app_notifications (installation_id, event_id, kind)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS participant_state_saved_idx
  ON participant_event_state (participant_user_id, saved);
