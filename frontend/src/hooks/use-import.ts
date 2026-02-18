import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { confirmImport, uploadCSV } from '@/api/import'
import { queryKeys } from '@/lib/query-keys'

function invalidateImportRelated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
}

export function useUploadCSV() {
  return useMutation({
    mutationFn: (file: File) => uploadCSV(file),
  })
}

export function useConfirmImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmImport,
    onSuccess: () => invalidateImportRelated(queryClient),
  })
}
