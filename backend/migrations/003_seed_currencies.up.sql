INSERT INTO currencies (code, name, symbol) VALUES
    ('USD', 'US Dollar', '$'),
    ('EUR', 'Euro', '€'),
    ('GBP', 'British Pound', '£'),
    ('JPY', 'Japanese Yen', '¥'),
    ('CNY', 'Chinese Yuan', '¥'),
    ('RUB', 'Russian Ruble', '₽'),
    ('AMD', 'Armenian Dram', '֏'),
    ('GEL', 'Georgian Lari', '₾'),
    ('TRY', 'Turkish Lira', '₺')
ON CONFLICT (code) DO NOTHING;
