-- A lab cannot have two active pieces of equipment with the same name.
-- Removed (inactive) equipment is left out so a name can be reused after removal.
CREATE UNIQUE INDEX equipment_lab_name_lower_key ON equipment (lab_id, lower(name)) WHERE active;
