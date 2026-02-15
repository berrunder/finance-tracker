import { Link } from 'react-router'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Transaction, Account, Category } from '@/types/api'

interface DashboardRecentProps {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
}

export function DashboardRecent({
  transactions,
  accounts,
  categories,
}: DashboardRecentProps) {
  const getAccountName = (accountId: string): string => {
    return accounts.find((a) => a.id === accountId)?.name ?? 'Unknown'
  }

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Uncategorized'
    return categories.find((c) => c.id === categoryId)?.name ?? 'Unknown'
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
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
        <CardTitle>Recent Transactions</CardTitle>
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
              className="flex items-center justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {transaction.description || 'No description'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getAccountName(transaction.account_id)} •{' '}
                  {getCategoryName(transaction.category_id)} •{' '}
                  {formatDate(transaction.date)}
                </p>
              </div>
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
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
