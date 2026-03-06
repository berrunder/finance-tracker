ALTER TABLE accounts DROP CONSTRAINT accounts_type_check;
UPDATE accounts SET type = 'deposit' WHERE type = 'bank';
UPDATE accounts SET type = 'other' WHERE type = 'savings';
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (type IN ('deposit', 'cash', 'credit_card', 'debit_card', 'other'));
