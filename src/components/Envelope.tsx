import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'

interface EnvelopeProps {
  onOpened: () => void
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function Envelope({ onOpened }: EnvelopeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const timing = (delay = 0) => ({
    duration: prefersReducedMotion ? 0 : 0.85,
    delay: prefersReducedMotion ? 0 : delay,
    ease: EASE,
  })

  const handleLetterAnimationComplete = () => {
    if (isOpen) onOpened()
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8C5C5]/25 blur-3xl" />

      <motion.section
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={timing()}
        className="relative z-10 flex w-full max-w-[460px] flex-col items-center text-center"
      >
        <h1 className="font-romantic text-3xl font-medium text-[#29201F] sm:text-4xl">
          A note, just for you
        </h1>
        <div className="mb-10 mt-5 flex items-center gap-3">
          <div className="h-px w-10 bg-[#D9B4B4]" />
          <Heart size={12} className="fill-[#873F50] text-[#873F50]" />
          <div className="h-px w-10 bg-[#D9B4B4]" />
        </div>

        <motion.button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isOpen}
          aria-label="Open the envelope to read your letter"
          aria-expanded={isOpen}
          whileHover={
            prefersReducedMotion || isOpen ? undefined : { y: -5, scale: 1.01 }
          }
          whileTap={prefersReducedMotion || isOpen ? undefined : { scale: 0.99 }}
          className="relative block aspect-[1.5] w-[min(86vw,420px)] cursor-pointer rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F9F1EC] disabled:cursor-default"
        >
          {/* Soft shadow beneath the envelope */}
          <div className="pointer-events-none absolute -bottom-5 left-1/2 h-9 w-[82%] -translate-x-1/2 rounded-[50%] bg-[#6C3141]/20 blur-xl" />

          {/* Back of the envelope */}
          <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[#F8E9E3] to-[#EBCFCA] shadow-[0_22px_45px_-20px_rgba(76,36,45,0.45)] ring-1 ring-[#DDB6B3]/60" />

          {/* The letter, tucked inside until the envelope is opened */}
          <div className="pointer-events-none absolute inset-[2%] z-10 overflow-hidden rounded-[10px]">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: isOpen ? '-32%' : '100%' }}
              transition={timing(0.35)}
              onAnimationComplete={handleLetterAnimationComplete}
              className="absolute inset-x-[8%] bottom-0 h-[70%] rounded-[4px] bg-[#FFFCF7] p-[6%] text-left shadow-[0_-3px_14px_rgba(82,45,52,0.10)] ring-1 ring-[#EFE2DC]"
            >
              <p className="font-romantic text-[clamp(0.7rem,2.4vw,0.95rem)] italic text-[#873F50]">
                Dear Roqeebah,
              </p>
              <div className="mt-[10%] space-y-[8%]">
                <div className="h-px w-full bg-[#EADBD4]" />
                <div className="h-px w-[88%] bg-[#EADBD4]" />
                <div className="h-px w-[94%] bg-[#EADBD4]" />
                <div className="h-px w-[62%] bg-[#EADBD4]" />
              </div>
            </motion.div>
          </div>

          {/* Side folds */}
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-[#E4C1BD]"
            style={{ clipPath: 'polygon(0 0, 0 100%, 50% 72%)' }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-[#E0BAB6]"
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 72%)' }}
          />

          {/* Front pocket fold */}
          <div
            className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-t from-[#F3DAD5] to-[#F7E6E0] drop-shadow-[0_-3px_4px_rgba(93,50,57,0.12)]"
            style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 43%)' }}
          />

          {/* Flap that lifts when the envelope is opened */}
          <motion.div
            initial={false}
            animate={{ rotateX: isOpen ? -180 : 0 }}
            transition={timing(0.1)}
            style={{
              transformOrigin: 'top center',
              transformPerspective: 900,
              backfaceVisibility: 'hidden',
            }}
            className="pointer-events-none absolute inset-0 z-40"
          >
            <div
              className="h-full w-full bg-gradient-to-b from-[#F7E4DE] to-[#E9C6C3] drop-shadow-[0_4px_5px_rgba(93,50,57,0.10)]"
              style={{ clipPath: 'polygon(0 0, 100% 0, 50% 62%)' }}
            />
          </motion.div>

          {/* Burgundy wax seal */}
          <div className="pointer-events-none absolute left-1/2 top-[53%] z-50 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              initial={false}
              animate={
                isOpen
                  ? { scale: 0, opacity: 0, rotate: 40 }
                  : { scale: 1, opacity: 1, rotate: 0 }
              }
              transition={{
                duration: prefersReducedMotion ? 0 : 0.45,
                ease: EASE,
              }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#873F50] shadow-[0_7px_16px_rgba(75,33,44,0.35)] ring-4 ring-[#F2D9D6]/80 sm:h-[72px] sm:w-[72px]"
            >
              <Heart
                size={24}
                strokeWidth={1.5}
                className="fill-[#FBEDE8] text-[#FBEDE8]"
              />
            </motion.div>
          </div>
        </motion.button>

        <p className="mt-8 flex items-center gap-3 text-xs tracking-[0.18em] text-[#756360] sm:text-sm">
          <span className="h-px w-6 bg-[#D9B4B4]" />
          Tap the envelope to open
          <span className="h-px w-6 bg-[#D9B4B4]" />
        </p>
      </motion.section>
    </main>
  )
}
