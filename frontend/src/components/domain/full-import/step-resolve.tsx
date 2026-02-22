import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Currency, NewCurrency } from '@/types/api'

const NEW_CURRENCY_VALUE = '__new__'

interface StepResolveProps {
  unresolvedCurrencies: string[]
  knownCurrencies: Currency[]
  currencyMapping: Record<string, string>
  newCurrencies: NewCurrency[]
  onUpdateMapping: (
    mapping: Record<string, string>,
    newCurrencies: NewCurrency[],
  ) => void
  onBack: () => void
  onNext: () => void
}

export function StepResolve({
  unresolvedCurrencies,
  knownCurrencies,
  currencyMapping,
  newCurrencies,
  onUpdateMapping,
  onBack,
  onNext,
}: StepResolveProps) {
  const [localMapping, setLocalMapping] = useState<Record<string, string>>(
    () => ({ ...currencyMapping }),
  )
  const [localNewCurrencies, setLocalNewCurrencies] = useState<
    Record<string, NewCurrency>
  >(() => {
    const map: Record<string, NewCurrency> = {}
    for (const nc of newCurrencies) {
      map[nc.symbol] = nc
    }
    return map
  })
  const [showNewForm, setShowNewForm] = useState<Record<string, boolean>>({})

  const allResolved = unresolvedCurrencies.every(
    (c) =>
      localMapping[c] ||
      (localNewCurrencies[c]?.code && localNewCurrencies[c]?.name),
  )

  function handleSelectChange(currencyStr: string, value: string) {
    if (value === NEW_CURRENCY_VALUE) {
      setShowNewForm((prev) => ({ ...prev, [currencyStr]: true }))
      const updated = { ...localMapping }
      delete updated[currencyStr]
      setLocalMapping(updated)
    } else {
      setShowNewForm((prev) => ({ ...prev, [currencyStr]: false }))
      setLocalMapping((prev) => ({ ...prev, [currencyStr]: value }))
      setLocalNewCurrencies((prev) => {
        const updated = { ...prev }
        delete updated[currencyStr]
        return updated
      })
    }
  }

  function handleNewCurrencyChange(
    currencyStr: string,
    field: keyof NewCurrency,
    value: string,
  ) {
    setLocalNewCurrencies((prev) => ({
      ...prev,
      [currencyStr]: {
        ...prev[currencyStr],
        [field]: field === 'code' ? value.toUpperCase() : value,
        symbol: currencyStr,
      },
    }))
  }

  function handleNext() {
    onUpdateMapping(localMapping, Object.values(localNewCurrencies))
    onNext()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        The following currency strings could not be automatically resolved. Map
        each to an existing currency or create a new one.
      </p>

      <div className="space-y-4">
        {unresolvedCurrencies.map((currStr) => (
          <div key={currStr} className="rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">
              &quot;{currStr}&quot;
            </div>
            <Select
              value={
                showNewForm[currStr]
                  ? NEW_CURRENCY_VALUE
                  : localMapping[currStr] || ''
              }
              onValueChange={(v) => handleSelectChange(currStr, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency..." />
              </SelectTrigger>
              <SelectContent>
                {knownCurrencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name} ({c.symbol})
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CURRENCY_VALUE}>
                  + Create new currency
                </SelectItem>
              </SelectContent>
            </Select>

            {showNewForm[currStr] && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Code (3 letters)</Label>
                  <Input
                    maxLength={3}
                    placeholder="AMD"
                    value={localNewCurrencies[currStr]?.code || ''}
                    onChange={(e) =>
                      handleNewCurrencyChange(currStr, 'code', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="Armenian Dram"
                    value={localNewCurrencies[currStr]?.name || ''}
                    onChange={(e) =>
                      handleNewCurrencyChange(currStr, 'name', e.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={!allResolved}>
          Next
        </Button>
      </div>
    </div>
  )
}
