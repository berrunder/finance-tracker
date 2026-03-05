ALTER TABLE categories DROP CONSTRAINT categories_user_id_parent_id_name_type_key;
CREATE UNIQUE INDEX categories_user_id_name_type_top_level ON categories (user_id, name, type) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX categories_user_id_parent_id_name_type ON categories (user_id, parent_id, name, type) WHERE parent_id IS NOT NULL;
