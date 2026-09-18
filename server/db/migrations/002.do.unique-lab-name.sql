-- A manager cannot own two labs with the same name.
CREATE UNIQUE INDEX labs_owner_name_lower_key ON labs (owner_id, lower(name));
