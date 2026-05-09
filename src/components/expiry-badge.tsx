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

  const variant =
    status === 'critical' ? 'danger' :
    status === 'warning'  ? 'warning' :
    status === 'ok'       ? 'success' :
    'neutral'

  return (
    <Badge variant={variant} className={cn('shrink-0', className)}>
      {label}
    </Badge>
  )
}
