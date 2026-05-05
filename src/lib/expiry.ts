import { differenceInDays, parseISO, startOfToday } from 'date-fns'

export type ExpiryStatus = 'critical' | 'warning' | 'ok' | 'unknown'

export function daysUntilExpiry(estimatedExpiryDate: string): number {
  return differenceInDays(parseISO(estimatedExpiryDate), startOfToday())
}

export function getExpiryStatus(estimatedExpiryDate: string | null): ExpiryStatus {
  if (!estimatedExpiryDate) return 'unknown'
  const days = daysUntilExpiry(estimatedExpiryDate)
  if (days <= 2) return 'critical'
  if (days <= 5) return 'warning'
  return 'ok'
}

export function formatExpiryLabel(estimatedExpiryDate: string | null, isEstimated: boolean): string {
  if (!estimatedExpiryDate) return ''
  const days = daysUntilExpiry(estimatedExpiryDate)
  if (days < 0) return 'Périmé'
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  if (days <= 7) return `${days}j`
  return isEstimated ? `~${Math.round(days / 7)}sem` : `${Math.round(days / 7)}sem`
}

export function estimateExpiryDate(defaultExpiryDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + defaultExpiryDays)
  return date.toISOString().split('T')[0]
}
