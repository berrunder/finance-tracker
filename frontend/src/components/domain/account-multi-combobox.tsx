import { useAccounts } from '@/hooks/use-accounts'
import { MultiCombobox } from '@/components/ui/multi-combobox'

interface AccountMultiComboboxProps {
  selected: string[]
  onSelectedChange: (selected: string[]) => void
}

export function AccountMultiCombobox({
  selected,
  onSelectedChange,
}: AccountMultiComboboxProps) {
  const { data: accounts = [] } = useAccounts()

  const options = accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }))

  return (
    <MultiCombobox
      options={options}
      selected={selected}
      onSelectedChange={onSelectedChange}
      placeholder="All accounts"
      searchPlaceholder="Search accounts..."
      emptyMessage="No accounts found."
    />
  )
}
