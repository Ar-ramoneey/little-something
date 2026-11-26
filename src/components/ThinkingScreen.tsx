import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Heart } from 'lucide-react'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function ThinkingScreen() {
  const prefersReducedMotion = useReducedMotion()

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.12,
        delayChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  }

  const item: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.65, ease: EASE },
    },
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-16 sm:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8C5C5]/25 blur-3xl" />

      <motion.section
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-xl text-center"
      >
        <motion.div variants={item} className="flex justify-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[#E8C5C5]/70" />
            <div className="absolute inset-3 rounded-full bg-white/60 shadow-[0_14px_36px_-20px_rgba(76,36,45,0.5)]" />
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative flex items-center justify-center"
            >
              <Heart
                size={44}
                strokeWidth={1.3}
                className="fill-[#E8C5C5] text-[#873F50]"
              />
            </motion.div>
          </div>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-10 font-romantic text-4xl font-medium leading-tight text-[#29201F] sm:text-5xl"
        >
          That's completely okay, Roqeebah.{' '}
          <span className="italic text-[#873F50]">❤️</span>
        </motion.h1>

        <motion.div variants={item} className="my-9 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-[#D9B4B4]" />
          <Heart size={13} className="fill-[#873F50] text-[#873F50]" />
          <div className="h-px w-12 bg-[#D9B4B4]" />
        </motion.div>

        <motion.p
          variants={item}
          className="mx-auto max-w-lg text-base leading-[1.9] text-[#756360] sm:text-lg"
        >
          I don't want you to feel pressured to give an answer. Take all the time
          you need. Whatever your decision is, I'll respect it.
        </motion.p>
      </motion.section>
    </main>
  )
}
