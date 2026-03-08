import { type ChangeEvent, useRef, useState } from 'react'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { useDescriptionSuggestions } from '@/hooks/use-description-suggestions'

function preventEvent(e: Event) {
  e.preventDefault()
}

interface DescriptionInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function DescriptionInput({
  value,
  onChange,
  placeholder,
}: DescriptionInputProps) {
  const [open, setOpen] = useState(false)
  const suggestions = useDescriptionSuggestions(value)
  const suppressBlurRef = useRef(false)
  const dismissedRef = useRef(false)

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    dismissedRef.current = false
    onChange(e.target.value)
  }

  function handleFocus() {
    if (!dismissedRef.current && suggestions.length > 0) {
      setOpen(true)
    }
  }

  function handleBlur() {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false
      return
    }
    setOpen(false)
  }

  function handleSelect(suggestion: string) {
    onChange(suggestion)
    setOpen(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      dismissedRef.current = true
    }
    setOpen(nextOpen)
  }

  function handleContentMouseDown() {
    suppressBlurRef.current = true
  }

  const shouldBeOpen = open && suggestions.length > 0

  return (
    <Popover open={shouldBeOpen} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={shouldBeOpen}
          aria-haspopup="listbox"
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={preventEvent}
        onMouseDown={handleContentMouseDown}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandGroup>
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion}
                  onSelect={() => handleSelect(suggestion)}
                >
                  {suggestion}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
