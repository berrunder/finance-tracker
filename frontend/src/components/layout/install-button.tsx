import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { cn } from '@/lib/utils'

interface InstallButtonProps {
  collapsed?: boolean
}

export function InstallButton({ collapsed = false }: InstallButtonProps) {
  const { canInstall, install } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <Button
      variant="ghost"
      size={collapsed ? 'icon' : 'sm'}
      onClick={install}
      className={cn(collapsed ? '' : 'w-full justify-start')}
      title="Install App"
    >
      <Download className="h-4 w-4" />
      {!collapsed && <span className="ml-2">Install App</span>}
    </Button>
  )
}
