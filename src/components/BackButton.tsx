import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  onClick: () => void
}

export default function BackButton({ onClick }: BackButtonProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Go back to the previous screen"
      title="Go back"
      initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -8 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      whileHover={prefersReducedMotion ? undefined : { x: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
      className="fixed left-4 top-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#873F50]/20 bg-[#FFFCF8]/90 px-4 py-2 text-xs font-medium text-[#873F50] shadow-[0_6px_20px_-10px_rgba(76,36,45,0.5)] backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F1EC] sm:left-6 sm:top-6 sm:text-sm"
    >
      <ArrowLeft size={15} />
      Back
    </motion.button>
  )
}
