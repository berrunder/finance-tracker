import Decimal from 'decimal.js'
import { formatMoney } from '@/lib/money'
import { groupAccountsByType, convertToBase } from '@/lib/account-groups'
import { useAuth } from '@/hooks/use-auth'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Account } from '@/types/api'

interface DashboardAccountsProps {
  accounts: Account[]
}

export function DashboardAccounts({ accounts }: DashboardAccountsProps) {
  const { user } = useAuth()
  const { data: rates = [] } = useExchangeRates()

  if (accounts.length <= 1 || !user) {
    return null
  }

  const groups = groupAccountsByType(accounts, user.base_currency, rates)
  const netWorth = accounts
    .reduce(
      (sum, a) => sum.add(convertToBase(a.balance, a.currency, user.base_currency, rates)),
      new Decimal(0),
    )
    .toFixed(2)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Account Balances</CardTitle>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Net Worth</p>
            <p className="text-lg font-bold">
              {formatMoney(netWorth, user.base_currency)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.type}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  {group.label}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {formatMoney(group.total, group.totalCurrency)}
                </span>
              </div>
              <div className="space-y-1">
                {group.accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <span className="font-medium">{account.name}</span>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatMoney(account.balance, account.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.currency}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
