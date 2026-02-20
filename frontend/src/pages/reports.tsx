import { useState } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { toISODate } from '@/lib/dates'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import {
  useSpendingByCategory,
  useIncomeExpense,
  useBalanceHistory,
} from '@/hooks/use-reports'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DatePicker } from '@/components/domain/date-picker'
import { SpendingChart } from '@/components/domain/spending-chart'
import { IncomeExpenseChart } from '@/components/domain/income-expense-chart'
import { BalanceHistoryChart } from '@/components/domain/balance-history-chart'
import { MultiCurrencyNote } from '@/components/domain/multi-currency-note'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function ReportsPage() {
  const { user } = useAuth()
  const now = new Date()

  // Date range state - defaults to current month
  const [dateFrom, setDateFrom] = useState<string>(toISODate(startOfMonth(now)))
  const [dateTo, setDateTo] = useState<string>(toISODate(endOfMonth(now)))

  // Account selector state for balance history
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Fetch accounts
  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts()

  // Fetch reports data
  const {
    data: spendingData = [],
    isLoading: isSpendingLoading,
    isError: isSpendingError,
    refetch: refetchSpending,
  } = useSpendingByCategory({
    date_from: dateFrom,
    date_to: dateTo,
  })

  const {
    data: incomeExpenseData = [],
    isLoading: isIncomeExpenseLoading,
    isError: isIncomeExpenseError,
    refetch: refetchIncomeExpense,
  } = useIncomeExpense({
    date_from: dateFrom,
    date_to: dateTo,
  })

  const {
    data: balanceHistoryData = [],
    isLoading: isBalanceHistoryLoading,
    isError: isBalanceHistoryError,
    refetch: refetchBalanceHistory,
  } = useBalanceHistory({
    account_id: selectedAccountId,
    date_from: dateFrom,
    date_to: dateTo,
  })

  if (!user) {
    return null
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const selectedAccountCurrency =
    selectedAccount?.currency ?? user.base_currency

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <MultiCurrencyNote baseCurrency={user.base_currency} accounts={accounts} />

      {/* Date Range Pickers */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>From Date</Label>
          <DatePicker
            value={dateFrom}
            onChange={(date) =>
              setDateFrom(date ?? toISODate(startOfMonth(new Date())))
            }
            placeholder="Select start date"
          />
        </div>
        <div className="space-y-2">
          <Label>To Date</Label>
          <DatePicker
            value={dateTo}
            onChange={(date) =>
              setDateTo(date ?? toISODate(endOfMonth(new Date())))
            }
            placeholder="Select end date"
          />
        </div>
      </div>

      {/* Spending and Income/Expense Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {isSpendingLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Skeleton className="h-48 w-48 rounded-full" />
            </CardContent>
          </Card>
        ) : (
          <SpendingChart
            data={spendingData}
            currency={user.base_currency}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isError={isSpendingError}
            onRetry={refetchSpending}
          />
        )}
        {isIncomeExpenseLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="flex items-end gap-3">
              {[40, 65, 30, 55, 45, 70].map((h, i) => (
                <Skeleton
                  key={i}
                  className="w-8 rounded-t"
                  style={{ height: `${h}%`, minHeight: h * 2 }}
                />
              ))}
            </CardContent>
          </Card>
        ) : (
          <IncomeExpenseChart
            data={incomeExpenseData}
            currency={user.base_currency}
            isError={isIncomeExpenseError}
            onRetry={refetchIncomeExpense}
          />
        )}
      </div>

      {/* Account Selector and Balance History Chart */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Account</Label>
          {isAccountsLoading ? (
            <Skeleton className="h-10 w-full md:w-[300px]" />
          ) : (
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedAccountId &&
          (isBalanceHistoryLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ) : (
            <BalanceHistoryChart
              data={balanceHistoryData}
              currency={selectedAccountCurrency}
              accountName={selectedAccount?.name}
              isError={isBalanceHistoryError}
              onRetry={refetchBalanceHistory}
            />
          ))}
      </div>
    </div>
  )
}
