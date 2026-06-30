import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline'
}

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'font-headline uppercase tracking-wide font-bold px-6 py-3 transition-colors duration-100 border-2 border-ink'

  const variants = {
    primary: 'bg-ink text-cream hover:bg-yellow hover:text-ink',
    outline: 'bg-cream text-ink hover:bg-yellow',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}