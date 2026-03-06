ALTER TABLE accounts DROP CONSTRAINT accounts_type_check;
UPDATE accounts SET type = 'bank' WHERE type = 'deposit';
UPDATE accounts SET type = 'savings' WHERE type = 'other';
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (type IN ('bank', 'cash', 'credit_card', 'savings'));
