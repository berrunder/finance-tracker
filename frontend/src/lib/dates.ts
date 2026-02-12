import { format, parseISO } from 'date-fns'

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'PP')
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d')
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
