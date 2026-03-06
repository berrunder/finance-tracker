import { formatMoney } from '@/lib/money'
import { groupAccountsByType } from '@/lib/account-groups'
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Balances</CardTitle>
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
