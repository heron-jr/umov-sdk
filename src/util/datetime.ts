const pad = (n: number) => String(n).padStart(2, '0')

/** Formato da API: YYYY-MM-DD HH:MM:SS (doc uMov.me). Strings passam intactas. */
export function formatDateTime(value: Date | string): string {
  if (typeof value === 'string') return value
  return `${formatDate(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

export function formatDate(value: Date | string): string {
  if (typeof value === 'string') return value
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
