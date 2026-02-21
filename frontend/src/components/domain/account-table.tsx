import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Account } from '@/types/api'

interface AccountTableProps {
  accounts: Account[]
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

function AccountActions({
  account,
  onEdit,
  onDelete,
}: {
  account: Account
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(account)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(account)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AccountTable({
  accounts,
  onEdit,
  onDelete,
}: AccountTableProps) {
  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No accounts yet. Create one to get started.
      </p>
    )
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {account.type.replaceAll('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>{account.currency}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(account.balance, account.currency)}
                </TableCell>
                <TableCell>
                  <AccountActions
                    account={account}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-2 md:hidden">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {account.name}
                </span>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {account.type.replaceAll('_', ' ')}
                </Badge>
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {account.currency} ·{' '}
                {formatMoney(account.balance, account.currency)}
              </div>
            </div>
            <AccountActions
              account={account}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
