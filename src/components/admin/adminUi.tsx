import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-romantic text-2xl text-[#29201F] sm:text-3xl">{children}</h2>
  )
}

export function SuccessMessage({ children }: { children: string }) {
  return (
    <div
      role="status"
      className="mt-5 rounded-xl border border-[#4E7A62]/30 bg-[#F1F7F2] px-4 py-3 text-sm leading-6 text-[#3F654F]"
    >
      {children}
    </div>
  )
}

export function ErrorMessage({ children }: { children: string }) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-xl border border-[#873F50]/30 bg-white px-4 py-3 text-sm leading-6 text-[#873F50]"
    >
      {children}
    </div>
  )
}

const baseButton =
  'rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${baseButton} bg-[#873F50] text-white hover:bg-[#6E3141] ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${baseButton} border border-[#873F50] text-[#873F50] hover:bg-[#873F50] hover:text-white ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function DangerButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${baseButton} border border-[#873F50] bg-white text-[#873F50] hover:bg-[#873F50] hover:text-white ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export const inputClass =
  'mt-2 w-full rounded-xl border border-[#EFE0DA] bg-white px-4 py-3 text-[#29201F] outline-none transition focus:border-[#873F50] focus:ring-2 focus:ring-[#873F50]/20'
