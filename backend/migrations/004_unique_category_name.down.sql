DROP INDEX IF EXISTS categories_user_id_name_type_top_level;
DROP INDEX IF EXISTS categories_user_id_parent_id_name_type;
ALTER TABLE categories ADD CONSTRAINT categories_user_id_parent_id_name_type_key UNIQUE (user_id, parent_id, name, type);
