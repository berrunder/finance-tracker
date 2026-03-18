import { useState } from 'react'
import { ChevronDown, ChevronRight, Scale } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { groupAccountsByType } from '@/lib/account-groups'
import { useAuth } from '@/hooks/use-auth'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CorrectionDialog } from '@/components/domain/correction-dialog'
import type { Account } from '@/types/api'

interface DashboardAccountsProps {
  accounts: Account[]
}

export function DashboardAccounts({ accounts }: DashboardAccountsProps) {
  const { user } = useAuth()
  const { data: rates = [] } = useExchangeRates()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [correctTarget, setCorrectTarget] = useState<Account | null>(null)

  if (accounts.length <= 1 || !user) {
    return null
  }

  const groups = groupAccountsByType(accounts, user.base_currency, rates)

  function toggleGroup(type: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Balances</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.type)
            return (
              <div key={group.type}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2 hover:bg-accent/50 rounded-md px-1 -mx-1 transition-colors"
                  onClick={() => toggleGroup(group.type)}
                  aria-expanded={isExpanded}
                >
                  <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {group.label}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {formatMoney(group.total, group.totalCurrency)}
                  </span>
                </button>
                {isExpanded && (
                  <div className="space-y-1 ml-5">
                    {group.accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between py-2 border-b last:border-b-0"
                      >
                        <span className="font-medium">{account.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-medium">
                              {formatMoney(account.balance, account.currency)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {account.currency}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setCorrectTarget(account)}
                            title="Correct balance"
                          >
                            <Scale className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>

      <CorrectionDialog
        account={correctTarget}
        onOpenChange={(open) => {
          if (!open) setCorrectTarget(null)
        }}
      />
    </Card>
  )
}
