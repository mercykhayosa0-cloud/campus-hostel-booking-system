import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number | string
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'primary' | 'warning'
}) {
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription className="font-medium">{label}</CardDescription>
          {Icon ? (
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-lg',
                tone === 'primary' && 'bg-primary/10 text-primary',
                tone === 'warning' && 'bg-warning/15 text-warning-foreground dark:text-warning',
                tone === 'default' && 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}
