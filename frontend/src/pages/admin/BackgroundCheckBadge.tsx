import type { BackgroundCheckStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL } from './backgroundCheck'

export function BackgroundCheckBadge({ status }: { status: BackgroundCheckStatus }) {
  const variant = status === 'flagged' ? 'destructive' : status === 'clear' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>
}
