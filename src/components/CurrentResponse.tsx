import { motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'
import type { ResponseRecord, ResponseValue } from '../api/responses'

interface CurrentResponseProps {
  response: ResponseRecord
  notice?: string | null
  onChange: () => void
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const DISPLAY: Record<ResponseValue, { badge: string; message: string }> = {
  yes: { badge: 'YES ❤️', message: 'You said yes. That made me incredibly happy.' },
  thinking: { badge: 'NEEDS TIME 💗', message: 'You asked for a little time. That is completely okay.' },
  no: { badge: 'NO', message: 'Thank you for being honest and kind about it.' },
}

function formatSavedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

export default function CurrentResponse({ response, notice, onChange }: CurrentResponseProps) {
  const prefersReducedMotion = useReducedMotion()
  const display = DISPLAY[response.response] ?? DISPLAY.no

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F1EC] px-6 py-14 sm:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8C5C5]/25 blur-3xl" />

      <motion.section
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease: EASE }}
        className="relative z-10 w-full max-w-xl text-center"
      >
        <div className="rounded-3xl border border-[#EFE0DA] bg-[#FFFCF8] p-8 shadow-[0_24px_60px_-38px_rgba(76,36,45,0.5)] sm:p-10">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#E8C5C5] bg-white/80">
              <Heart size={30} strokeWidth={1.4} className="fill-[#E8C5C5] text-[#873F50]" />
            </div>
          </div>

          <p className="mt-7 text-xs font-medium uppercase tracking-[0.3em] text-[#873F50]">
            Your answer is saved
          </p>
          <h1 className="mt-3 font-romantic text-3xl leading-tight text-[#29201F] sm:text-4xl">
            This is what you told me
          </h1>

          {notice && (
            <p
              role="status"
              className="mt-6 rounded-full bg-[#873F50]/10 px-5 py-2 text-sm font-medium text-[#873F50]"
            >
              {notice}
            </p>
          )}

          <p className="mt-8 font-romantic text-4xl text-[#873F50] sm:text-5xl">{display.badge}</p>
          <p className="mt-3 text-sm leading-7 text-[#756360]">{display.message}</p>

          <div className="my-8 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-[#D9B4B4]" />
            <Heart size={13} className="fill-[#873F50] text-[#873F50]" />
            <div className="h-px w-12 bg-[#D9B4B4]" />
          </div>

          <p className="text-xs text-[#756360]">Last updated {formatSavedAt(response.updated_at)}</p>

          <button
            type="button"
            onClick={onChange}
            className="mt-8 w-full rounded-full border border-[#873F50] bg-white px-8 py-4 text-sm font-medium text-[#873F50] transition hover:bg-[#E8C5C5]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#873F50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFCF8]"
          >
            Change my answer
          </button>

          <p className="mt-5 text-xs leading-5 text-[#756360]">
            This answer is remembered for this browser. If you use another browser or clear your
            cookies, you may need to verify your invitation again.
          </p>
        </div>
      </motion.section>
    </main>
  )
}
