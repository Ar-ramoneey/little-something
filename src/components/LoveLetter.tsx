import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Heart } from 'lucide-react'

interface LoveLetterProps {
  onContinue: () => void
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const paragraphs = [
  "I know we haven't known each other for very long, and perhaps we've only shared a few conversations at school.",
  'But sometimes, even the simplest interactions can make you want to know someone a little more.',
  "I've found myself wanting to know more about you, your thoughts, your dreams, and the little things that make you who you are.",
  "I don't want to pretend that I already know everything about you. Instead, I'd love the opportunity to discover those things, one conversation at a time.",
  "There's something about you that caught my attention, and I would genuinely love to see where getting to know you could lead.",
]

export default function LoveLetter({ onContinue }: LoveLetterProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-5 py-14 sm:px-8 sm:py-20">
      <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#E8C5C5]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-[#873F50]/10 blur-3xl" />

      <motion.article
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: EASE }}
        className="relative z-10 w-full max-w-2xl rounded-[4px] border border-[#EFE0DA] bg-[#FFFCF8] px-6 py-10 shadow-[0_24px_70px_-28px_rgba(76,36,45,0.45)] sm:px-14 sm:py-14"
      >
        <div className="mb-9 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#EAD3CF]" />
          <Heart size={13} className="fill-[#873F50] text-[#873F50]" />
          <div className="h-px flex-1 bg-[#EAD3CF]" />
        </div>

        <p className="font-romantic text-2xl italic text-[#873F50] sm:text-3xl">
          Dear Roqeebah,
        </p>

        <div className="mt-7 space-y-6 text-[15px] leading-[1.9] text-[#4A3B39] sm:text-base">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-10 text-right">
          <p className="font-romantic text-lg italic text-[#873F50]">
            With sincerity,
          </p>
          <p className="mt-2 font-romantic text-base italic text-[#4A3B39]">
            Someone who would love to know you better.
          </p>
        </div>

        <div className="mt-12 flex justify-center border-t border-[#EFE0DA] pt-9 sm:justify-end">
          <motion.button
            type="button"
            onClick={onContinue}
            whileHover={
              prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }
            }
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            className="inline-flex max-w-full items-center justify-center gap-3 rounded-full border border-[#873F50]/70 px-7 py-4 text-center text-sm font-medium text-[#873F50] transition-colors hover:bg-[#873F50] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF8] min-h-11 sm:text-[15px]"
          >
            There's one more thing I'd like to ask you...
            <ArrowRight size={16} className="shrink-0" />
          </motion.button>
        </div>
      </motion.article>
    </main>
  )
}
