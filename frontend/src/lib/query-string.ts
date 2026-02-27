export function buildQueryString<T extends object>(args: T): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== '') {
          params.append(key, String(item))
        }
      }
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
