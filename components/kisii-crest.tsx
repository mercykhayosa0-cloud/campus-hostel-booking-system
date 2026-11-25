import { cn } from '@/lib/utils'

export function KisiiCrest({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
    >
      <path
        d="M20 2.5L34 7.5V19.5C34 28.1 28.1 34.9 20 37.5C11.9 34.9 6 28.1 6 19.5V7.5L20 2.5Z"
        className="fill-primary stroke-gold"
        strokeWidth="2"
      />
      <path
        d="M12.5 14.5C14.8 13.4 17.4 13.4 19.5 14.5V26.5C17.4 25.4 14.8 25.4 12.5 26.5V14.5Z"
        className="fill-primary-foreground/95"
      />
      <path
        d="M27.5 14.5C25.2 13.4 22.6 13.4 20.5 14.5V26.5C22.6 25.4 25.2 25.4 27.5 26.5V14.5Z"
        className="fill-primary-foreground/80"
      />
      <circle cx="20" cy="10" r="2.2" className="fill-gold" />
    </svg>
  )
}
