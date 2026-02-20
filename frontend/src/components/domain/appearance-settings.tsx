import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Label } from '@/components/ui/label'

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label>Theme</Label>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(value) => {
            if (value) setTheme(value as 'light' | 'dark' | 'system')
          }}
          variant="outline"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} className="gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
