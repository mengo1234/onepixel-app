ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_kind_check;
ALTER TABLE venues ADD CONSTRAINT venues_kind_check CHECK (
  kind IN ('stadium', 'arena', 'concert', 'square', 'outdoor', 'fairground', 'custom')
);

CREATE TABLE IF NOT EXISTS venue_layouts (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venue_id, name, version)
);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_kind_check;
ALTER TABLE events ADD CONSTRAINT events_kind_check CHECK (
  kind IN ('sport', 'concert', 'festival', 'demonstration', 'gathering', 'parade', 'fair', 'civic', 'temporary', 'other')
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_id TEXT REFERENCES venue_layouts(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS program JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_name TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_policy JSONB NOT NULL DEFAULT '{"visibility":"public","methods":["qr"],"discoveryRadiusM":3000}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS participant_limit INTEGER NOT NULL DEFAULT 1000000 CHECK (participant_limit > 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_snapshot JSONB;

CREATE TABLE IF NOT EXISTS event_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('small', 'medium', 'large')),
  participant_limit INTEGER NOT NULL CHECK (participant_limit > 0),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_session_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'consumed', 'refunded', 'failed')),
  consumed_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_payment_id_fkey;
ALTER TABLE events ADD CONSTRAINT events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES event_payments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS participant_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('password', 'google')),
  provider_subject TEXT,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'it' CHECK (locale IN ('it', 'en')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_installations (
  id TEXT PRIMARY KEY,
  participant_user_id TEXT REFERENCES participant_users(id) ON DELETE SET NULL,
  push_token TEXT,
  locale TEXT NOT NULL DEFAULT 'it',
  platform TEXT NOT NULL DEFAULT 'android',
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  location_enabled BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participant_event_state (
  participant_user_id TEXT NOT NULL REFERENCES participant_users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  saved BOOLEAN NOT NULL DEFAULT false,
  ticket_token TEXT,
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (participant_user_id, event_id)
);

CREATE TABLE IF NOT EXISTS event_joins (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  participant_user_id TEXT REFERENCES participant_users(id) ON DELETE SET NULL,
  method TEXT NOT NULL CHECK (method IN ('qr', 'fixed_geofence', 'mobile_radius')),
  zone_id TEXT NOT NULL,
  seat_id TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, installation_id)
);

CREATE TABLE IF NOT EXISTS event_leader_location (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title_it TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_it TEXT NOT NULL,
  body_en TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venue_layouts_venue_idx ON venue_layouts(venue_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS payments_org_status_idx ON event_payments(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS joins_event_idx ON event_joins(event_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS notifications_installation_idx ON app_notifications(installation_id, created_at DESC);
