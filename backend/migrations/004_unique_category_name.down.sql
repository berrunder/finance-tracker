ALTER TABLE categories DROP CONSTRAINT categories_user_id_name_type_key;
ALTER TABLE categories ADD CONSTRAINT categories_user_id_parent_id_name_type_key UNIQUE (user_id, parent_id, name, type);
