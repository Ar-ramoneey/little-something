
import { motion, useReducedMotion } from 'framer-motion'
import { Heart, Sparkles } from 'lucide-react'

interface WelcomeScreenProps {
  onContinue: () => void
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function WelcomeScreen({
  onContinue,
}: WelcomeScreenProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-12">

      {/* Decorative background circles */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#E8C5C5]/30 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#873F50]/10 blur-3xl" />

      {/* Main content */}
      <motion.section
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.75, ease: EASE }}
        className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center"
      >
        {/* Decorative heart */}
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="mb-9 flex h-20 w-20 items-center justify-center rounded-full border border-[#E8C5C5] bg-white/70 shadow-[0_12px_30px_-20px_rgba(76,36,45,0.45)]"
        >
          <Heart
            size={32}
            strokeWidth={1.4}
            className="fill-[#E8C5C5] text-[#873F50]"
          />
        </motion.div>

        {/* Small heading */}
        <div className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.35em] text-[#873F50]">
          <Sparkles size={14} />
          A special message
          <Sparkles size={14} />
        </div>

        {/* Main heading */}
        <h1 className="font-romantic text-5xl font-medium leading-tight text-[#29201F] sm:text-7xl">
          A little something
          <br />
          <span className="italic text-[#873F50]">
            for Roqeebah
          </span>
        </h1>

        {/* Divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px w-12 bg-[#D9B4B4]" />
          <Heart size={13} className="fill-[#873F50] text-[#873F50]" />
          <div className="h-px w-12 bg-[#D9B4B4]" />
        </div>

        {/* Description */}
        <p className="max-w-md text-base leading-8 text-[#756360] sm:text-lg">
          Some feelings are better expressed with a
          little thought and a little courage.
          I have something I'd really love to share with you.
        </p>

        {/* Continue button */}
        <motion.button
          type="button"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          onClick={onContinue}
          className="mt-11 inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#873F50] px-9 py-4 text-sm font-medium text-white shadow-lg shadow-[#873F50]/20 transition-colors hover:bg-[#713343] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F1EC]"
        >
          Open your little surprise
          <Heart size={16} className="fill-white" />
        </motion.button>

        {/* Footer */}
        <p className="mt-14 text-xs tracking-[0.18em] text-[#756360]">
          MADE WITH A LITTLE COURAGE & A LOT OF THOUGHT
        </p>
      </motion.section>
    </main>
  )
}
