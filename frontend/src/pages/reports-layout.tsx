import { Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MultiCurrencyNote } from '@/components/domain/multi-currency-note'

const REPORT_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'cash-flow', label: 'Cash Flow' },
] as const

type ReportTab = (typeof REPORT_TABS)[number]['value']

function tabFromPath(pathname: string): ReportTab {
  const segment = pathname.split('/').filter(Boolean).at(1)
  return REPORT_TABS.find((t) => t.value === segment)?.value ?? 'overview'
}

export default function ReportsLayout() {
  const { user } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const location = useLocation()
  const navigate = useNavigate()

  const currentTab = tabFromPath(location.pathname)

  if (!user) {
    return null
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <MultiCurrencyNote
        baseCurrency={user.base_currency}
        accounts={accounts}
      />

      <Tabs
        value={currentTab}
        onValueChange={(value) =>
          navigate(`/reports/${value}`, { replace: true })
        }
      >
        <TabsList>
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  )
}
