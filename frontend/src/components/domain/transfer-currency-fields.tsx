import { useEffect, useRef } from 'react'
import Decimal from 'decimal.js'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TransferCurrencyFieldsProps {
  amount: string
  toAmount: string
  exchangeRate: string
  onAmountChange: (value: string) => void
  onToAmountChange: (value: string) => void
  onExchangeRateChange: (value: string) => void
  fromCurrency: string
  toCurrency: string
}

function isValidDecimal(value: string): boolean {
  if (!value) return false
  try {
    const d = new Decimal(value)
    return d.isFinite() && d.gt(0)
  } catch {
    return false
  }
}

export function TransferCurrencyFields({
  amount,
  toAmount,
  exchangeRate,
  onAmountChange,
  onToAmountChange,
  onExchangeRateChange,
  fromCurrency,
  toCurrency,
}: TransferCurrencyFieldsProps) {
  const lastEdited = useRef<'amount' | 'toAmount' | 'rate'>('amount')

  useEffect(() => {
    if (lastEdited.current === 'rate') return
    if (isValidDecimal(amount) && isValidDecimal(toAmount)) {
      const rate = new Decimal(toAmount).div(amount).toFixed(6)
      onExchangeRateChange(rate)
    }
  }, [amount, onExchangeRateChange, toAmount])

  function handleAmountChange(value: string) {
    lastEdited.current = 'amount'
    onAmountChange(value)
    if (isValidDecimal(value) && isValidDecimal(exchangeRate)) {
      const computed = new Decimal(value).mul(exchangeRate).toFixed(2)
      onToAmountChange(computed)
    }
  }

  function handleToAmountChange(value: string) {
    lastEdited.current = 'toAmount'
    onToAmountChange(value)
    if (isValidDecimal(value) && isValidDecimal(amount)) {
      // Prefer recalculating rate from amount + toAmount
      const rate = new Decimal(value).div(amount).toFixed(6)
      onExchangeRateChange(rate)
    } else if (isValidDecimal(value) && isValidDecimal(exchangeRate)) {
      // Fallback: compute amount from toAmount + rate
      const computedAmount = new Decimal(value).div(exchangeRate).toFixed(2)
      onAmountChange(computedAmount)
    }
  }

  function handleRateChange(value: string) {
    lastEdited.current = 'rate'
    onExchangeRateChange(value)
    if (isValidDecimal(value) && isValidDecimal(amount)) {
      const computed = new Decimal(amount).mul(value).toFixed(2)
      onToAmountChange(computed)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Send amount ({fromCurrency})</Label>
        <Input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-1">
        <Label>Receive amount ({toCurrency})</Label>
        <Input
          type="text"
          inputMode="decimal"
          value={toAmount}
          onChange={(e) => handleToAmountChange(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">
          Exchange rate ({fromCurrency} → {toCurrency})
        </Label>
        <Input
          type="text"
          inputMode="decimal"
          value={exchangeRate}
          onChange={(e) => handleRateChange(e.target.value)}
          placeholder="1.000000"
        />
      </div>
      {isValidDecimal(exchangeRate) && (
        <p className="text-muted-foreground text-xs">
          Implied rate: {exchangeRate} {fromCurrency}/{toCurrency}
        </p>
      )}
    </div>
  )
}
