import { HTMLAttributes } from 'react'

export default function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-cream border-2 border-ink p-6 transition-colors duration-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}