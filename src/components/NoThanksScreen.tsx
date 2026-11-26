import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Heart } from 'lucide-react'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function NoThanksScreen() {
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
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8C5C5]/20 blur-3xl" />

      <motion.section
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-xl text-center"
      >
        <motion.div variants={item} className="flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#E8C5C5] bg-white/70 shadow-[0_14px_36px_-20px_rgba(76,36,45,0.45)]">
            <Heart size={38} strokeWidth={1.3} className="text-[#873F50]" />
          </div>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-10 font-romantic text-4xl font-medium leading-tight text-[#29201F] sm:text-5xl"
        >
          Thank you for being honest with me, Roqeebah. <span className="text-[#873F50]">❤️</span>
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
          Whatever your answer, I appreciate you taking the time to read my message. I wish you
          nothing but happiness.
        </motion.p>

        <motion.p
          variants={item}
          className="mt-12 font-romantic text-lg italic text-[#873F50]"
        >
          With respect and warmth,
        </motion.p>
      </motion.section>
    </main>
  )
}
