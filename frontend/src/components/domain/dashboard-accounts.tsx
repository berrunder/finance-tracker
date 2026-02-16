import { formatMoney } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Account } from '@/types/api'

interface DashboardAccountsProps {
  accounts: Account[]
}

export function DashboardAccounts({ accounts }: DashboardAccountsProps) {
  if (accounts.length <= 1) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Balances</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
            >
              <div className="flex flex-col">
                <span className="font-medium">{account.name}</span>
                <span className="text-sm text-muted-foreground">
                  {account.type}
                </span>
              </div>
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
      </CardContent>
    </Card>
  )
}
