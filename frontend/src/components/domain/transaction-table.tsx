import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/dates'
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
import { cn } from '@/lib/utils'
import type { Transaction, Account, Category } from '@/types/api'

interface TransactionTableProps {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  total: number
  hasNextPage?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}

function getCategoryLabel(
  categoryId: string | null,
  categories: Category[],
): string {
  if (!categoryId) return '\u2014'
  for (const cat of categories) {
    if (cat.id === categoryId) return cat.name
    if (cat.children) {
      for (const child of cat.children) {
        if (child.id === categoryId) return `${cat.name} > ${child.name}`
      }
    }
  }
  return '\u2014'
}

function getAccountName(accountId: string, accounts: Account[]): string {
  return accounts.find((a) => a.id === accountId)?.name ?? '\u2014'
}

function getTransferDescription(
  tx: Transaction,
  transactions: Transaction[],
  accounts: Account[],
): string {
  if (!tx.transfer_id) return tx.description || '\u2014'

  const linked = transactions.find((item) => item.id === tx.transfer_id)
  const currentAccount = getAccountName(tx.account_id, accounts)
  const linkedAccount = linked
    ? getAccountName(linked.account_id, accounts)
    : '\u2014'

  if (tx.type === 'expense') {
    return `Transfer: ${currentAccount} \u2192 ${linkedAccount}`
  }
  return `Transfer: ${linkedAccount} \u2192 ${currentAccount}`
}

function amountColorClass(type: string): string {
  if (type === 'income') return 'text-green-600 dark:text-green-400'
  if (type === 'expense') return 'text-red-600 dark:text-red-400'
  return ''
}

function TransactionActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TransactionTable({
  transactions,
  accounts,
  categories,
  total,
  hasNextPage,
  onLoadMore,
  isLoadingMore,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No transactions found.
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
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTransferDescription(tx, transactions, accounts)}
                    {tx.transfer_id && (
                      <Badge variant="outline" className="text-xs">
                        Transfer
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getCategoryLabel(tx.category_id, categories)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-medium',
                    amountColorClass(tx.type),
                  )}
                >
                  {tx.type === 'expense' ? '\u2212' : '+'}
                  {formatMoney(tx.amount, tx.currency)}
                </TableCell>
                <TableCell>{getAccountName(tx.account_id, accounts)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(tx)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-8 w-8"
                      onClick={() => onDelete(tx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-2 md:hidden">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {getTransferDescription(tx, transactions, accounts)}
                </span>
                {tx.transfer_id && (
                  <Badge variant="outline" className="shrink-0 text-xs">
                    Transfer
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {formatDate(tx.date)} ·{' '}
                {getAccountName(tx.account_id, accounts)}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {getCategoryLabel(tx.category_id, categories)}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={cn('text-sm font-medium', amountColorClass(tx.type))}
              >
                {tx.type === 'expense' ? '\u2212' : '+'}
                {formatMoney(tx.amount, tx.currency)}
              </span>
              <TransactionActions
                onEdit={() => onEdit(tx)}
                onDelete={() => onDelete(tx)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer: count + load more */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Showing {transactions.length} of {total}
        </p>
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        )}
      </div>
    </div>
  )
}
