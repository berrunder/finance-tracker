import { type ChangeEvent, type KeyboardEvent, useRef, useState } from 'react'
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
  const suggestionsKey = suggestions.join('\0')
  const [selectedState, setSelectedIndex] = useState({
    key: suggestionsKey,
    index: 0,
  })
  const selectedIndex =
    selectedState.key === suggestionsKey ? selectedState.index : 0

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    dismissedRef.current = false
    setOpen(true)
    onChange(e.target.value)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!(open && suggestions.length > 0)) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => ({
          key: suggestionsKey,
          index:
            (prev.key === suggestionsKey ? prev.index + 1 : 1) %
            suggestions.length,
        }))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => ({
          key: suggestionsKey,
          index:
            ((prev.key === suggestionsKey ? prev.index : 0) -
              1 +
              suggestions.length) %
            suggestions.length,
        }))
        break
      case 'Enter':
        e.preventDefault()
        handleSelect(suggestions[selectedIndex])
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        dismissedRef.current = true
        break
    }
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
          onKeyDown={handleKeyDown}
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
        <Command
          shouldFilter={false}
          value={suggestions[selectedIndex]}
          onValueChange={(val) => {
            const normalizedVal = val.toLowerCase()
            const idx = suggestions.findIndex(
              (s) => s.toLowerCase() === normalizedVal,
            )
            if (idx >= 0) setSelectedIndex({ key: suggestionsKey, index: idx })
          }}
        >
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
