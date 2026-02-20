import { z } from 'zod'
import { ACCOUNT_TYPES, CATEGORY_TYPES } from './constants'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be at most 50 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirm_password: z.string(),
    display_name: z
      .string()
      .min(1, 'Display name is required')
      .max(100, 'Display name must be at most 100 characters'),
    base_currency: z.string().length(3, 'Please select a currency'),
    invite_code: z.string().min(1, 'Invite code is required'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

const moneyRegex = /^\d+(\.\d{1,2})?$/
const rateRegex = /^\d+(\.\d{1,6})?$/

export const accountSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  type: z.enum(ACCOUNT_TYPES, { message: 'Please select an account type' }),
  currency: z.string().length(3, 'Please select a currency'),
  initial_balance: z
    .string()
    .regex(moneyRegex, 'Must be a valid amount (max 2 decimals)'),
})

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  type: z.enum(CATEGORY_TYPES, { message: 'Please select a category type' }),
  parent_id: z.string().nullable().optional(),
})

export const transactionSchema = z.object({
  account_id: z.string().min(1, 'Please select an account'),
  category_id: z.string().min(1, 'Please select a category'),
  type: z.enum(['income', 'expense'], { message: 'Please select a type' }),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(moneyRegex, 'Must be a valid amount (max 2 decimals)'),
  description: z.string(),
  date: z.string().min(1, 'Date is required'),
})

export const transferSchema = z
  .object({
    from_account_id: z.string().min(1, 'Please select a source account'),
    to_account_id: z.string().min(1, 'Please select a destination account'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .regex(moneyRegex, 'Must be a valid amount (max 2 decimals)'),
    to_amount: z
      .string()
      .regex(moneyRegex, 'Must be a valid amount (max 2 decimals)')
      .optional()
      .or(z.literal('')),
    exchange_rate: z
      .string()
      .regex(rateRegex, 'Must be a valid rate (max 6 decimals)')
      .optional()
      .or(z.literal('')),
    description: z.string(),
    date: z.string().min(1, 'Date is required'),
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: 'Source and destination must be different',
    path: ['to_account_id'],
  })

export const profileSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters'),
  base_currency: z.string().length(3, 'Please select a currency'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type AccountFormData = z.infer<typeof accountSchema>
export type CategoryFormData = z.infer<typeof categorySchema>
export type TransactionFormData = z.infer<typeof transactionSchema>
export type ProfileFormData = z.infer<typeof profileSchema>
export type TransferFormData = z.infer<typeof transferSchema>
