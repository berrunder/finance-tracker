import { useState } from 'react'
import { Sidebar } from './sidebar'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu, Wallet } from 'lucide-react'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tabletExpanded, setTabletExpanded] = useState(false)

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar (>= 1024px) */}
      <aside className="hidden border-r lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </aside>

      {/* Tablet sidebar (768-1023px) — collapsed icons only */}
      <aside
        className={cn(
          'hidden border-r md:flex md:flex-col lg:hidden',
          'transition-all duration-200',
          tabletExpanded ? 'md:w-64' : 'md:w-16',
        )}
        onMouseEnter={() => setTabletExpanded(true)}
        onMouseLeave={() => setTabletExpanded(false)}
      >
        <Sidebar collapsed={!tabletExpanded} />
      </aside>

      {/* Mobile top bar + sheet overlay (< 768px) */}
      <div className="bg-background fixed top-0 right-0 left-0 z-40 flex items-center border-b p-4 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Wallet className="ml-2 h-5 w-5 text-primary" />
        <span className="ml-2 font-semibold">Finance Tracker</span>
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-6 md:pt-6">
        {children}
      </main>
    </div>
  )
}
