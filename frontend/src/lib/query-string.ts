export function buildSearchParams<T extends object>(args: T): URLSearchParams {
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
  return params
}

export function buildQueryString<T extends object>(args: T): string {
  const qs = buildSearchParams(args).toString()
  return qs ? `?${qs}` : ''
}
