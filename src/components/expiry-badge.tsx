import { Badge } from '@/components/ui/badge'
import { getExpiryStatus, formatExpiryLabel } from '@/lib/expiry'
import { cn } from '@/lib/utils'

type Props = {
  estimatedExpiryDate: string | null
  isEstimated: boolean
  className?: string
}

export default function ExpiryBadge({ estimatedExpiryDate, isEstimated, className }: Props) {
  const status = getExpiryStatus(estimatedExpiryDate)
  const label = formatExpiryLabel(estimatedExpiryDate, isEstimated)

  if (!label) return null

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium shrink-0',
        status === 'critical' && 'border-red-300 bg-red-50 text-red-700',
        status === 'warning' && 'border-amber-300 bg-amber-50 text-amber-700',
        status === 'ok' && 'border-green-300 bg-green-50 text-green-700',
        status === 'unknown' && 'border-stone-200 bg-stone-50 text-stone-500',
        className
      )}
    >
      {label}
    </Badge>
  )
}
