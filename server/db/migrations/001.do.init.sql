-- Needed for the reservations_no_overlap constraint below: GiST has no = operator for bigint without it.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Represents a user.
-- Members and lab managers share one table so a username is unique across both.
CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text        NOT NULL CHECK (length(btrim(username)) > 0),
  password_hash text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('member', 'manager')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

-- A lab is an equipment calendar owned by exactly one manager. 
CREATE TABLE labs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text        NOT NULL CHECK (length(btrim(name)) > 0),
  --Foreign key from the users table 
  --Using restrict here to avoid random labs without a user. 
  owner_id   bigint      NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX labs_owner_id_idx ON labs (owner_id);

-- Used to grant a member access to an equipment calendar/lab. 
CREATE TABLE memberships (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  --Foreign keys from the labs/users tables. 
  lab_id     bigint      NOT NULL REFERENCES labs (id)  ON DELETE CASCADE,
  user_id    bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, user_id)
);

CREATE INDEX memberships_user_id_idx ON memberships (user_id);

-- Represents a piece of equipment that belongs to a calendar. 
CREATE TABLE equipment (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  --Foreign keys from the labs table. 
  lab_id      bigint      NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (length(btrim(name)) > 0),
  description text        NOT NULL DEFAULT '',
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX equipment_lab_id_active_idx ON equipment (lab_id) WHERE active;

-- Represnts a reservation made by a member/manager. 
CREATE TABLE reservations (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  --Foreign keys from the equipment table. 
  equipment_id bigint      NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
  user_id      bigint      NOT NULL REFERENCES users (id)     ON DELETE CASCADE,
  start_time   timestamptz NOT NULL,
  end_time     timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  --Basic checks that should also be done server side. 
  CONSTRAINT reservations_time_order CHECK (end_time > start_time),

  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    equipment_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE INDEX reservations_user_id_idx ON reservations (user_id);
