-- ListingPilot AI: saved workspaces.
-- One row per workspace, scoped by owner (anonymous cookie id until you add auth).
CREATE TABLE IF NOT EXISTS listingpilot_workspaces (
  owner           text        NOT NULL,
  id              text        NOT NULL,
  name            text        NOT NULL,
  product_count   integer     NOT NULL DEFAULT 0,
  generated_count integer     NOT NULL DEFAULT 0,
  data            jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, id)
);

CREATE INDEX IF NOT EXISTS listingpilot_workspaces_owner_updated_idx
  ON listingpilot_workspaces (owner, updated_at DESC);
