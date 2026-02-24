import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Step } from './helpers'

function stepStyle(current: Step, n: Step): string {
  if (current === n) return 'bg-primary text-primary-foreground'
  if (current > n) return 'bg-primary/20 text-primary'
  return 'bg-muted text-muted-foreground'
}

const STEPS = [
  { n: 1 as const, label: 'Upload' },
  { n: 2 as const, label: 'Resolve' },
  { n: 3 as const, label: 'Preview' },
  { n: 4 as const, label: 'Results' },
]

export function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map(({ n, label }, idx) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              stepStyle(current, n),
            )}
          >
            {current > n ? <Check className="size-3.5" /> : n}
          </div>
          <span
            className={cn(
              'hidden text-sm font-medium md:inline',
              current === n ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
          {idx < STEPS.length - 1 && (
            <div className="mx-1 h-px w-4 bg-border md:w-8" />
          )}
        </div>
      ))}
    </div>
  )
}
