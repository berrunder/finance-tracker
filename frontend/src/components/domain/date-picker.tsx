import * as React from 'react'
import IMask from 'imask'
import { IMaskInput } from 'react-imask'
import { CalendarIcon } from 'lucide-react'
import { parseISO } from 'date-fns'
import { formatDateMask, toISODate } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()

interface DatePickerProps {
  value?: string
  onChange: (date: string | undefined) => void
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'DD.MM.YYYY',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(
    value ? formatDateMask(value) : '',
  )

  // Sync input when value is changed externally (e.g. form reset)
  React.useEffect(() => {
    setInputValue(value ? formatDateMask(value) : '')
  }, [value])

  const selected = value ? parseISO(value) : undefined

  return (
    <div className="relative w-full">
      <IMaskInput
        mask={Date}
        pattern="d{.}m{.}Y"
        blocks={{
          d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
          m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
          Y: {
            mask: IMask.MaskedRange,
            from: 1900,
            to: CURRENT_YEAR + 1,
            maxLength: 4,
          },
        }}
        format={(date: Date | null) =>
          date ? formatDateMask(toISODate(date)) : ''
        }
        parse={(str: string) => {
          const [day, month, year] = str.split('.').map(Number)
          return new Date(year, month - 1, day)
        }}
        min={new Date(1900, 0, 1)}
        max={new Date()}
        value={inputValue}
        onAccept={(val: string) => {
          setInputValue(val)
          if (!val) onChange(undefined)
        }}
        onComplete={(val: string) => {
          const [day, month, year] = val.split('.').map(Number)
          const date = new Date(year, month - 1, day)
          onChange(toISODate(date))
        }}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-xs transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          !value && 'text-muted-foreground',
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            tabIndex={-1}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date()}
            onSelect={(date) => {
              onChange(date ? toISODate(date) : undefined)
              setOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
