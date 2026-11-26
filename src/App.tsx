import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import {
  getCurrentResponse,
  submitResponse,
  updateResponse,
  type ResponseRecord,
  type ResponseValue,
} from './api/responses'
import WelcomeScreen from './components/WelcomeScreen'
import Envelope from './components/Envelope'
import LoveLetter from './components/LoveLetter'
import Proposal from './components/Proposal'
import AcceptanceScreen from './components/AcceptanceScreen'
import ThinkingScreen from './components/ThinkingScreen'
import NoThanksScreen from './components/NoThanksScreen'
import InvitationCode from './components/InvitationCode'
import CurrentResponse from './components/CurrentResponse'
import BackButton from './components/BackButton'
import { AdminAuthProvider } from './auth/AdminAuthProvider'
import AdminApp from './components/admin/AdminApp'
import { isAdminArea, usePathname } from './lib/router'

type Screen =
  | 'welcome'
  | 'envelope'
  | 'letter'
  | 'invitation'
  | 'proposal'
  | 'current'
  | 'accepted'
  | 'thinking'
  | 'declined'

type SessionState = 'checking' | 'verified' | 'unverified'
type SubmitMode = 'initial' | 'change'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

function screenForResponse(response: ResponseValue): Screen {
  if (response === 'yes') return 'accepted'
  if (response === 'thinking') return 'thinking'
  return 'declined'
}

function ProposalApp() {
  const [history, setHistory] = useState<Screen[]>(['welcome'])
  const screen = history[history.length - 1]
  const prefersReducedMotion = useReducedMotion()

  const sessionStateRef = useRef<SessionState>('checking')
  const currentResponseRef = useRef<ResponseRecord | null>(null)
  const sessionCheckRef = useRef<Promise<void>>(Promise.resolve())

  const [currentResponse, setCurrentResponse] = useState<ResponseRecord | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [mode, setMode] = useState<SubmitMode>('initial')
  const [notice, setNotice] = useState<string | null>(null)

  const applySession = useCallback((state: SessionState, record: ResponseRecord | null) => {
    sessionStateRef.current = state
    currentResponseRef.current = record
    setCurrentResponse(record)
  }, [])

  const goTo = useCallback((next: Screen, replace = false) => {
    setHistory((current) => (replace ? [...current.slice(0, -1), next] : [...current, next]))
  }, [])

  const goBack = useCallback(() => {
    setHistory((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }, [])

  useEffect(() => {
    let active = true

    sessionCheckRef.current = getCurrentResponse()
      .then((record) => {
        if (!active) return
        applySession('verified', record)
        setSessionError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        applySession('unverified', null)
        setSessionError(error instanceof Error ? error.message : null)
      })

    return () => {
      active = false
    }
  }, [applySession])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [screen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') goBack()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goBack])

  // We wait for the initial session check so a returning visitor sees her saved
  // answer instead of being asked to verify again.
  const continueAfterLetter = useCallback(async () => {
    await sessionCheckRef.current

    const state = sessionStateRef.current
    const record = currentResponseRef.current

    setMode('initial')
    setNotice(null)
    goTo(state === 'verified' && record ? 'current' : state === 'verified' ? 'proposal' : 'invitation')
  }, [goTo])

  const handleInvitationVerified = useCallback(async () => {
    await sessionCheckRef.current

    const record = await getCurrentResponse().catch(() => null)

    applySession('verified', record)
    setSessionError(null)
    setNotice(null)
    goTo(record ? 'current' : 'proposal', true)
  }, [applySession, goTo])

  const handleStartChange = useCallback(() => {
    setMode('change')
    setNotice(null)
    goTo('proposal')
  }, [goTo])

  const handleSubmitAnswer = useCallback(
    async (response: ResponseValue) => {
      const record =
        mode === 'change' ? await updateResponse(response) : await submitResponse(response)

      applySession('verified', record)

      if (mode === 'change') {
        setNotice('Your answer has been updated.')
        goTo('current')
      } else {
        setNotice(null)
        goTo(screenForResponse(response))
      }
    },
    [applySession, goTo, mode],
  )

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {history.length > 1 && <BackButton key="back" onClick={goBack} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: EASE }}
          className="min-h-screen bg-[#F9F1EC]"
        >
          {screen === 'welcome' && <WelcomeScreen onContinue={() => goTo('envelope')} />}
          {screen === 'envelope' && (
            <Envelope onOpened={() => goTo('letter')} />
          )}
          {screen === 'letter' && (
            <LoveLetter onContinue={() => void continueAfterLetter()} />
          )}
          {screen === 'invitation' && (
            <InvitationCode
              onVerified={handleInvitationVerified}
              initialError={sessionError}
            />
          )}
          {screen === 'current' &&
            (currentResponse ? (
              <CurrentResponse
                response={currentResponse}
                notice={notice}
                onChange={handleStartChange}
              />
            ) : (
              <InvitationCode
                onVerified={handleInvitationVerified}
                initialError={sessionError}
              />
            ))}
          {screen === 'proposal' && (
            <Proposal onSubmit={handleSubmitAnswer} mode={mode} />
          )}
          {screen === 'accepted' && <AcceptanceScreen />}
          {screen === 'thinking' && <ThinkingScreen />}
          {screen === 'declined' && <NoThanksScreen />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}

export default function App() {
  const path = usePathname()

  if (isAdminArea(path)) {
    return (
      <AdminAuthProvider>
        <AdminApp path={path} />
      </AdminAuthProvider>
    )
  }

  return <ProposalApp />
}
