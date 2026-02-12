import { NavLink } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Upload,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/import', label: 'Import', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onNavigate?: () => void
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()

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
      <nav className="flex-1 space-y-1 p-2">
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

      {/* User section */}
      <div
        className={cn(
          'p-4',
          collapsed ? 'flex flex-col items-center gap-2' : '',
        )}
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
