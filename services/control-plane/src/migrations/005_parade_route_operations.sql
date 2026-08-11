CREATE TABLE IF NOT EXISTS parade_route_stop_runs (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stop_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'executed', 'cancelled', 'missed')),
  scheduled_for TIMESTAMPTZ,
  command_id TEXT REFERENCES live_commands(id) ON DELETE SET NULL,
  triggered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, stop_id)
);

CREATE INDEX IF NOT EXISTS parade_route_stop_runs_event_status_idx
  ON parade_route_stop_runs (event_id, status, scheduled_for);
