import { HTMLAttributes } from 'react'

export default function Label({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-headline uppercase tracking-widest text-xs text-muted ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}