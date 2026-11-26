import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Heart } from 'lucide-react'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const confetti = [
  { left: '6%', size: 6, color: '#873F50', delay: 0.2, duration: 7, round: true },
  { left: '15%', size: 8, color: '#E8C5C5', delay: 1.1, duration: 6.2, round: false },
  { left: '24%', size: 5, color: '#D9B4B4', delay: 2.4, duration: 7.5, round: true },
  { left: '33%', size: 9, color: '#F3DAD5', delay: 0.7, duration: 6.8, round: false },
  { left: '42%', size: 6, color: '#873F50', delay: 3.1, duration: 7.2, round: false },
  { left: '51%', size: 7, color: '#E8C5C5', delay: 1.8, duration: 6.5, round: true },
  { left: '60%', size: 5, color: '#D9B4B4', delay: 0.4, duration: 7.8, round: false },
  { left: '69%', size: 8, color: '#F3DAD5', delay: 2.7, duration: 6.4, round: true },
  { left: '78%', size: 6, color: '#873F50', delay: 1.5, duration: 7.1, round: false },
  { left: '87%', size: 7, color: '#E8C5C5', delay: 3.4, duration: 6.7, round: true },
  { left: '95%', size: 5, color: '#D9B4B4', delay: 0.9, duration: 7.6, round: false },
]

const floatingHearts = [
  { left: '12%', top: '26%', size: 15, delay: 0.3, duration: 6 },
  { left: '82%', top: '34%', size: 12, delay: 1.6, duration: 7 },
  { left: '22%', top: '70%', size: 11, delay: 2.2, duration: 6.5 },
  { left: '76%', top: '74%', size: 14, delay: 0.8, duration: 7.2 },
]

export default function AcceptanceScreen() {
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
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.65, ease: EASE },
    },
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-16 sm:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8C5C5]/30 blur-3xl" />

      {!prefersReducedMotion && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((piece) => (
            <motion.span
              key={`${piece.left}-${piece.delay}`}
              className="absolute top-0 block"
              style={{
                left: piece.left,
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: piece.round ? '9999px' : '2px',
              }}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: '105vh', opacity: [0, 0.7, 0.7, 0] }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}

          {floatingHearts.map((heart) => (
            <motion.div
              key={`${heart.left}-${heart.top}`}
              className="absolute text-[#873F50]/30"
              style={{ left: heart.left, top: heart.top }}
              animate={{ y: [0, -18, 0], opacity: [0.25, 0.5, 0.25] }}
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
        </div>
      )}

      <motion.section
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-xl text-center"
      >
        <motion.div variants={item} className="flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#E8C5C5] bg-white/80 shadow-[0_12px_30px_-18px_rgba(76,36,45,0.45)]">
            <Heart
              size={38}
              strokeWidth={1.3}
              className="fill-[#E8C5C5] text-[#873F50]"
            />
          </div>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-10 font-romantic text-4xl font-medium leading-tight text-[#29201F] sm:text-5xl"
        >
          Roqeebah, you just made my day! <span className="italic text-[#873F50]">❤️</span>
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
          Thank you for giving me this opportunity. I look forward to getting to
          know you better, sharing beautiful moments, and seeing where this
          journey takes us.
        </motion.p>

        <motion.p
          variants={item}
          className="mt-14 font-romantic text-lg italic tracking-wide text-[#873F50]"
        >
          A new chapter begins...
        </motion.p>
      </motion.section>
    </main>
  )
}
