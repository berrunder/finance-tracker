export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '\u20ac', name: 'Euro' },
  { code: 'GBP', symbol: '\u00a3', name: 'British Pound' },
  { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '\u00a5', name: 'Chinese Yuan' },
  { code: 'RUB', symbol: '\u20bd', name: 'Russian Ruble' },
  { code: 'AMD', symbol: '\u058f', name: 'Armenian Dram' },
  { code: 'GEL', symbol: '\u20be', name: 'Georgian Lari' },
  { code: 'TRY', symbol: '\u20ba', name: 'Turkish Lira' },
] as const

export const ACCOUNT_TYPES = ['bank', 'cash', 'credit_card', 'savings'] as const
export const CATEGORY_TYPES = ['income', 'expense'] as const

export const REFRESH_TOKEN_KEY = 'refresh_token'
export const THEME_KEY = 'theme'
