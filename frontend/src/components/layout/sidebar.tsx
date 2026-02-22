import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/use-auth.ts'
import { useAccounts } from '@/hooks/use-accounts'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Upload,
  FileUp,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/import/full', label: 'Full Import', icon: FileUp },
  { to: '/import/account', label: 'Account Import', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onNavigate?: () => void
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const navigate = useNavigate()

  function navigateToAccount(accountId: string) {
    navigate(`/transactions?account_id=${accountId}`)
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col">
      {/* App logo/name */}
      <div
        className={cn(
          'flex items-center p-4',
          collapsed ? 'justify-center' : 'gap-2',
        )}
      >
        <Wallet className="h-6 w-6 text-primary" />
        {!collapsed && (
          <span className="text-lg font-bold">Finance Tracker</span>
        )}
      </div>

      <Separator />

      {/* Navigation links */}
      <nav className="space-y-1 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent text-accent-foreground',
                collapsed && 'justify-center px-2',
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* Account balances */}
      {!collapsed ? (
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-muted-foreground mb-1 px-3 text-xs font-medium">
            Accounts
          </p>
          {accountsLoading ? (
            <div className="space-y-2 px-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted h-6 animate-pulse rounded" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-muted-foreground px-3 text-xs">No accounts</p>
          ) : (
            <div className="space-y-0.5">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => navigateToAccount(account.id)}
                  className="hover:bg-accent flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left transition-colors"
                >
                  <span className="truncate text-xs font-medium">
                    {account.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatMoney(account.balance, account.currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {accountsLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-muted mx-auto h-6 w-8 animate-pulse rounded"
                />
              ))}
            </div>
          ) : (
            accounts.map((account) => (
              <Tooltip key={account.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigateToAccount(account.id)}
                    className="hover:bg-accent flex w-full justify-center rounded-md px-2 py-1.5 transition-colors"
                  >
                    <span className="text-muted-foreground text-xs">
                      {account.currency}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>
                    {account.name}:{' '}
                    {formatMoney(account.balance, account.currency)}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))
          )}
        </div>
      )}

      <Separator />

      {/* User section */}
      <div
        className={cn('p-4', collapsed && 'flex flex-col items-center gap-2')}
      >
        {!collapsed && (
          <p className="mb-2 truncate text-sm font-medium">
            {user?.display_name}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          onClick={logout}
          className={collapsed ? '' : 'w-full justify-start'}
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Log out</span>}
        </Button>
      </div>
    </div>
  )
}
