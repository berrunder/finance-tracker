export function buildQueryString<T extends object>(args: T): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
