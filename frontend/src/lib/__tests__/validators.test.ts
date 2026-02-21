import {
  loginSchema,
  registerSchema,
  accountSchema,
  categorySchema,
  transactionSchema,
  transferSchema,
  profileSchema,
} from '../validators'

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const result = loginSchema.safeParse({ username: 'user', password: 'pass' })
    expect(result.success).toBe(true)
  })

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'pass' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ username: 'user', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const validData = {
    username: 'testuser',
    password: 'password123',
    confirm_password: 'password123',
    display_name: 'Test User',
    base_currency: 'USD',
    invite_code: 'ABC123',
  }

  it('accepts valid input', () => {
    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects short username', () => {
    const result = registerSchema.safeParse({ ...validData, username: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: 'short',
      confirm_password: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password mismatch', () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirm_password: 'different',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('confirm_password')
    }
  })

  it('rejects empty display name', () => {
    const result = registerSchema.safeParse({
      ...validData,
      display_name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid currency length', () => {
    const result = registerSchema.safeParse({
      ...validData,
      base_currency: 'US',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty invite code', () => {
    const result = registerSchema.safeParse({
      ...validData,
      invite_code: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('accountSchema', () => {
  const validData = {
    name: 'Checking',
    type: 'bank' as const,
    currency: 'USD',
    initial_balance: '1000.00',
  }

  it('accepts valid input', () => {
    expect(accountSchema.safeParse(validData).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(accountSchema.safeParse({ ...validData, name: '' }).success).toBe(
      false,
    )
  })

  it('rejects invalid account type', () => {
    expect(
      accountSchema.safeParse({ ...validData, type: 'crypto' }).success,
    ).toBe(false)
  })

  it('rejects invalid balance format (3 decimals)', () => {
    expect(
      accountSchema.safeParse({ ...validData, initial_balance: '10.123' })
        .success,
    ).toBe(false)
  })

  it('accepts whole number balance', () => {
    expect(
      accountSchema.safeParse({ ...validData, initial_balance: '100' }).success,
    ).toBe(true)
  })

  it('accepts balance with one decimal', () => {
    expect(
      accountSchema.safeParse({ ...validData, initial_balance: '100.5' })
        .success,
    ).toBe(true)
  })
})

describe('categorySchema', () => {
  it('accepts valid input', () => {
    expect(
      categorySchema.safeParse({ name: 'Food', type: 'expense' }).success,
    ).toBe(true)
  })

  it('accepts optional parent_id', () => {
    expect(
      categorySchema.safeParse({
        name: 'Fast Food',
        type: 'expense',
        parent_id: '123',
      }).success,
    ).toBe(true)
  })

  it('accepts null parent_id', () => {
    expect(
      categorySchema.safeParse({
        name: 'Food',
        type: 'expense',
        parent_id: null,
      }).success,
    ).toBe(true)
  })

  it('rejects invalid type', () => {
    expect(
      categorySchema.safeParse({ name: 'Food', type: 'transfer' }).success,
    ).toBe(false)
  })
})

describe('transactionSchema', () => {
  const validData = {
    account_id: 'acc-1',
    category_id: 'cat-1',
    type: 'expense' as const,
    amount: '50.00',
    description: 'Lunch',
    date: '2024-01-15',
  }

  it('accepts valid input', () => {
    expect(transactionSchema.safeParse(validData).success).toBe(true)
  })

  it('rejects missing account', () => {
    expect(
      transactionSchema.safeParse({ ...validData, account_id: '' }).success,
    ).toBe(false)
  })

  it('rejects invalid amount format', () => {
    expect(
      transactionSchema.safeParse({ ...validData, amount: '10.123' }).success,
    ).toBe(false)
  })

  it('rejects empty date', () => {
    expect(
      transactionSchema.safeParse({ ...validData, date: '' }).success,
    ).toBe(false)
  })

  it('accepts empty description', () => {
    expect(
      transactionSchema.safeParse({ ...validData, description: '' }).success,
    ).toBe(true)
  })
})

describe('transferSchema', () => {
  const validData = {
    from_account_id: 'acc-1',
    to_account_id: 'acc-2',
    amount: '100.00',
    description: 'Transfer',
    date: '2024-01-15',
  }

  it('accepts valid input', () => {
    expect(transferSchema.safeParse(validData).success).toBe(true)
  })

  it('rejects same source and destination account', () => {
    const result = transferSchema.safeParse({
      ...validData,
      to_account_id: 'acc-1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('to_account_id')
    }
  })

  it('accepts optional to_amount', () => {
    expect(
      transferSchema.safeParse({ ...validData, to_amount: '95.50' }).success,
    ).toBe(true)
  })

  it('accepts empty to_amount', () => {
    expect(
      transferSchema.safeParse({ ...validData, to_amount: '' }).success,
    ).toBe(true)
  })

  it('rejects invalid to_amount format', () => {
    expect(
      transferSchema.safeParse({ ...validData, to_amount: '10.123' }).success,
    ).toBe(false)
  })

  it('accepts valid exchange_rate', () => {
    expect(
      transferSchema.safeParse({ ...validData, exchange_rate: '1.123456' })
        .success,
    ).toBe(true)
  })

  it('rejects exchange_rate with too many decimals', () => {
    expect(
      transferSchema.safeParse({ ...validData, exchange_rate: '1.1234567' })
        .success,
    ).toBe(false)
  })
})

describe('profileSchema', () => {
  it('accepts valid input', () => {
    expect(
      profileSchema.safeParse({
        display_name: 'Test User',
        base_currency: 'USD',
      }).success,
    ).toBe(true)
  })

  it('rejects empty display name', () => {
    expect(
      profileSchema.safeParse({ display_name: '', base_currency: 'USD' })
        .success,
    ).toBe(false)
  })

  it('rejects invalid currency length', () => {
    expect(
      profileSchema.safeParse({ display_name: 'User', base_currency: 'US' })
        .success,
    ).toBe(false)
  })
})
