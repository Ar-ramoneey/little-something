import { useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Heart } from 'lucide-react'
import type { ResponseValue } from '../api/responses'
import { apiErrorMessage } from '../api/responses'

interface ProposalProps {
  onSubmit: (response: ResponseValue) => Promise<void>
  mode?: 'initial' | 'change'
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const floatingHearts = [
  { left: '9%', top: '32%', size: 14, delay: 0.2, duration: 6 },
  { left: '88%', top: '62%', size: 11, delay: 1.4, duration: 7 },
]

export default function Proposal({ onSubmit, mode = 'initial' }: ProposalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [pending, setPending] = useState<ResponseValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = pending !== null

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.11,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  }

  const item: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.55, ease: EASE },
    },
  }

  async function handleSubmit(response: ResponseValue) {
    if (busy) return

    setError(null)
    setPending(response)

    try {
      await onSubmit(response)
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
      setPending(null)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-16 sm:px-8">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#E8C5C5]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-[#873F50]/10 blur-3xl" />

      {!prefersReducedMotion &&
        floatingHearts.map((heart) => (
          <motion.div
            key={heart.left}
            aria-hidden="true"
            className="pointer-events-none absolute hidden text-[#873F50]/30 sm:block"
            style={{ left: heart.left, top: heart.top }}
            animate={{ y: [0, -14, 0] }}
            transition={{
              duration: heart.duration,
              delay: heart.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Heart size={heart.size} className="fill-[#E8C5C5]" />
          </motion.div>
        ))}

      <motion.section
        variants={container}
        initial="hidden"
        animate="visible"
        aria-label="A question for Roqeebah"
        aria-busy={busy}
        className="relative z-10 w-full max-w-2xl text-center"
      >
        <motion.div variants={item} className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#E8C5C5] bg-white/70 shadow-sm">
            <Heart
              size={30}
              strokeWidth={1.4}
              className="fill-[#E8C5C5] text-[#873F50]"
            />
          </div>
        </motion.div>

        <motion.p
          variants={item}
          className="mt-9 text-sm tracking-[0.12em] text-[#873F50] sm:text-base"
        >
          There's something I've been wanting to ask you...
        </motion.p>

        <motion.h1
          variants={item}
          className="mt-5 font-romantic text-5xl font-medium italic leading-tight text-[#873F50] sm:text-7xl"
        >
          Roqeebah
        </motion.h1>

        <motion.div variants={item} className="my-9 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-[#D9B4B4]" />
          <Heart size={13} className="fill-[#873F50] text-[#873F50]" />
          <div className="h-px w-12 bg-[#D9B4B4]" />
        </motion.div>

        <motion.div
          variants={item}
          className="mx-auto max-w-xl space-y-5 text-base leading-[1.9] text-[#756360] sm:text-lg"
        >
          <p>
            I've really enjoyed the little moments we've shared, and I'd love
            the opportunity to make more memories with you.
          </p>
          <p>
            I don't want to rush anything, but I want you to know that my
            interest in you is genuine.
          </p>
        </motion.div>

        <motion.h2
          variants={item}
          className="mx-auto mt-9 max-w-xl font-romantic text-2xl font-medium leading-snug text-[#29201F] sm:mt-11 sm:text-4xl sm:leading-tight"
        >
          Would you make me happy by being my girlfriend?
        </motion.h2>

        {mode === 'change' && (
          <motion.p variants={item} className="mt-5 text-sm text-[#873F50]">
            You can change your answer. No pressure at all.
          </motion.p>
        )}

        <motion.div
          variants={item}
          className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap"
        >
          {busy && (
            <motion.p
              role="status"
              className="w-full text-sm font-medium text-[#873F50]"
            >
              Saving your answer…
            </motion.p>
          )}

          {error && (
            <motion.p
              role="alert"
              className="w-full rounded-2xl border border-[#873F50]/30 bg-white/70 px-4 py-3 text-sm text-[#873F50]"
            >
              {error} Please try again.
            </motion.p>
          )}

          <motion.button
            type="button"
            onClick={() => void handleSubmit('yes')}
            disabled={busy}
            whileHover={prefersReducedMotion || busy ? undefined : { y: -2, scale: 1.02 }}
            whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.98 }}
            className="min-h-11 w-full rounded-full bg-[#873F50] px-8 py-4 text-sm font-medium text-white shadow-lg shadow-[#873F50]/20 transition-colors hover:bg-[#713343] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F1EC] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-[15px]"
          >
            {pending === 'yes' ? 'Saving…' : "Yes, I'd love to!"}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => void handleSubmit('thinking')}
            disabled={busy}
            whileHover={prefersReducedMotion || busy ? undefined : { y: -2, scale: 1.02 }}
            whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.98 }}
            className="min-h-11 w-full rounded-full border border-[#873F50]/60 bg-white/60 px-8 py-4 text-sm font-medium text-[#873F50] transition-colors hover:bg-[#E8C5C5]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F1EC] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-[15px]"
          >
            {pending === 'thinking' ? 'Saving…' : "I'd like some time to think."}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => void handleSubmit('no')}
            disabled={busy}
            whileHover={prefersReducedMotion || busy ? undefined : { y: -2, scale: 1.02 }}
            whileTap={prefersReducedMotion || busy ? undefined : { scale: 0.98 }}
            className="min-h-11 w-full rounded-full border border-[#873F50]/40 bg-[#E8C5C5]/25 px-8 py-4 text-sm font-medium text-[#873F50] transition-colors hover:bg-[#E8C5C5]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F1EC] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-[15px]"
          >
            {pending === 'no' ? 'Saving…' : 'No, thank you.'}
          </motion.button>
        </motion.div>
      </motion.section>
    </main>
  )
}
