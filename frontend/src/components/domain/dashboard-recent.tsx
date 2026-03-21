import { Link } from 'react-router'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/domain/error-banner'
import {
  TransactionActionsInline,
  TransactionActionsMenu,
} from '@/components/domain/transaction-row-actions'
import type { Transaction, Account, Category } from '@/types/api'

interface DashboardRecentProps {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  isError?: boolean
  onRetry?: () => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}

const EM_DASH = '\u2014'

const TITLE = 'Recent Transactions'

function getAccountName(accountId: string, accounts: Account[]): string {
  return accounts.find((a) => a.id === accountId)?.name ?? EM_DASH
}

function getCategoryName(
  categoryId: string | null,
  categories: Category[],
): string {
  if (!categoryId) return 'Transfer'
  for (const cat of categories) {
    if (cat.id === categoryId) return cat.name
    if (cat.children) {
      for (const child of cat.children) {
        if (child.id === categoryId) return `${cat.name} > ${child.name}`
      }
    }
  }
  return EM_DASH
}

export function DashboardRecent({
  transactions,
  accounts,
  categories,
  isError,
  onRetry,
  onEdit,
  onDelete,
}: DashboardRecentProps) {
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{TITLE}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBanner
            message="Failed to load recent transactions."
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{TITLE}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transactions yet. Add your first transaction to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{TITLE}</CardTitle>
        <Link
          to="/transactions"
          className="text-sm text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {getAccountName(transaction.account_id, accounts)} •{' '}
                  {getCategoryName(transaction.category_id, categories)}
                </p>
                {transaction.description && (
                  <p className="text-sm text-muted-foreground">
                    {transaction.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">
                    {formatDate(transaction.date)}
                  </p>
                  <div
                    className={`font-medium ${
                      transaction.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatMoney(transaction.amount, transaction.currency)}
                  </div>
                </div>
                <div className="hidden md:block">
                  <TransactionActionsInline
                    onEdit={() => onEdit(transaction)}
                    onDelete={() => onDelete(transaction)}
                  />
                </div>
                <div className="md:hidden">
                  <TransactionActionsMenu
                    onEdit={() => onEdit(transaction)}
                    onDelete={() => onDelete(transaction)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
