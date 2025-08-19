import { useEffect, useMemo, useRef, useState } from 'react'
import { TimeDisplay, LastFocus } from './components/TimeDisplay'
import { PrimaryButton } from './components/PrimaryButton'
import { MidnightBanner } from './components/MidnightBanner'
import { PauseModal } from './components/PauseModal'

type State = 'idle' | 'running' | 'paused'

const EIGHT_HOURS = 8 * 60 * 60 * 1000
const LS_HISTORY = 'focusHistory' // { [YYYY-MM-DD]: number(ms) }
const LS_STATE = 'currentState' // { state, focusedMs, sinceStartMs, startedAt }

function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function isoOf(date: Date) { return todayISO(date) }

function loadHistory(): Record<string, number> {
  try { const raw = localStorage.getItem(LS_HISTORY); return raw ? JSON.parse(raw) : {} } catch { return {} }
}
function saveHistory(h: Record<string, number>) {
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(h)) } catch {}
}
function loadState(): { state: State, focusedMs: number, sinceStartMs: number, startedAt: number | null } | null {
  try {
    const raw = localStorage.getItem(LS_STATE)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function saveState(state: State, focusedMs: number, sinceStartMs: number, startedAt: number | null) {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify({ state, focusedMs, sinceStartMs, startedAt }))
  } catch {}
}
function pruneTo7Days(history: Record<string, number>): Record<string, number> {
  const entries = Object.entries(history)
  entries.sort(([a], [b]) => a.localeCompare(b))
  const last7 = entries.slice(-7)
  const next: Record<string, number> = {}
  for (const [k, v] of last7) next[k] = v
  return next
}
function latestFinished(history: Record<string, number>): { date: string, ms: number } | null {
  const entries = Object.entries(history)
  if (!entries.length) return null
  entries.sort(([a], [b]) => a.localeCompare(b))
  const [date, ms] = entries[entries.length - 1]
  return { date, ms }
}

export default function App() {
  const savedState = loadState()
  const [state, setState] = useState<State>(savedState?.state ?? 'idle')
  const [focusedMs, setFocusedMs] = useState(savedState?.focusedMs ?? 0)
  const [sinceStartMs, setSinceStartMs] = useState(savedState?.sinceStartMs ?? 0)
  const [history, setHistory] = useState<Record<string, number>>(() => loadHistory())
  const [midnightWarn, setMidnightWarn] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)

  const startedAtRef = useRef<number | null>(savedState?.startedAt ?? null)
  const lastTickRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const lastEntry = useMemo(() => latestFinished(history), [history])

  // 1) running일 때만 오늘 집중시간 증가
  useEffect(() => {
    if (state !== 'running') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTickRef.current = null
      return
    }
    const loop = (now: number) => {
      if (!lastTickRef.current) lastTickRef.current = now
      const dt = now - lastTickRef.current
      lastTickRef.current = now
      setFocusedMs(v => v + dt)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [state])

  // 2) 출근 이후 경과 (8시간 라벨 전환용)
  useEffect(() => {
    const id = setInterval(() => {
      if (startedAtRef.current && state !== 'idle') setSinceStartMs(Date.now() - startedAtRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  // 3) 자정 롤오버: 오늘 focused를 어제로 저장하고 리셋 + idle
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date()
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        const yISO = isoOf(yesterday)
        setHistory(h => {
          const next = { ...h, [yISO]: (h[yISO] ?? 0) + focusedMs }
          const pruned = pruneTo7Days(next)
          saveHistory(pruned)
          return pruned
        })
        // reset to idle
        setFocusedMs(0)
        setSinceStartMs(0)
        setState('idle')
        startedAtRef.current = null
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [focusedMs])

  // 4) 상태 저장
  useEffect(() => {
    saveState(state, focusedMs, sinceStartMs, startedAtRef.current)
  }, [state, focusedMs, sinceStartMs])

  // 5) 외출 상태일 때 모달 표시
  useEffect(() => {
    if (state === 'paused') {
      const timer = setTimeout(() => setShowPauseModal(true), 1000)
      return () => clearTimeout(timer)
    } else {
      setShowPauseModal(false)
    }
  }, [state])

  // 6) 자정 5분 전 경고 + 비프
  useEffect(() => {
    function msToNextMidnight(date = new Date()) {
      const next = new Date(date)
      next.setHours(24, 0, 0, 0)
      return next.getTime() - date.getTime()
    }
    const now = new Date()
    const msToMidnight = msToNextMidnight(now)
    const warnAt = msToMidnight - 5 * 60 * 1000
    let warnTimer: number | undefined
    let resetTimer: number | undefined

    if (warnAt <= 0) setMidnightWarn(true)
    else warnTimer = window.setTimeout(() => {
      setMidnightWarn(true)
      try {
        const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext
        const ctx = new Ctx()
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = 880
        o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0.0001, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01)
        o.start(); o.stop(ctx.currentTime + 0.15)
      } catch {}
    }, warnAt)

    resetTimer = window.setTimeout(() => setMidnightWarn(false), msToMidnight + 2000)
    return () => { if (warnTimer) clearTimeout(warnTimer); if (resetTimer) clearTimeout(resetTimer) }
  }, [state])

  // 7) 버튼 라벨 및 상태 텍스트
  const primaryLabel = useMemo(() => {
    if (state === 'idle') return '출근'
    if (sinceStartMs >= EIGHT_HOURS) return '퇴근'
    return state === 'running' ? '외출' : '재개'
  }, [state, sinceStartMs])

  const statusText = useMemo(() => {
    if (state === 'idle') return null
    if (state === 'running') return '집중 중'
    if (state === 'paused') return '외출 중'
    return null
  }, [state])

  // 8) 액션
  function handlePrimary() {
    if (state === 'idle') {
      startedAtRef.current = Date.now()
      setSinceStartMs(0)
      setFocusedMs(0)
      setState('running')
      return
    }
    if (sinceStartMs >= EIGHT_HOURS) {
      // 수동 퇴근: 오늘 기록을 오늘 날짜로 저장
      const tISO = todayISO()
      setHistory(h => {
        const next = { ...h, [tISO]: (h[tISO] ?? 0) + focusedMs }
        const pruned = pruneTo7Days(next)
        saveHistory(pruned)
        return pruned
      })
      // reset
      setFocusedMs(0)
      setSinceStartMs(0)
      setState('idle')
      startedAtRef.current = null
      return
    }
    // 토글
    setState(s => (s === 'running' ? 'paused' : 'running'))
  }

  return (
    <div className="wrap">
      <MidnightBanner show={midnightWarn} />

      <div className="card">
        <h1>오늘 투자한 시간</h1>
        <TimeDisplay ms={focusedMs} status={statusText ?? undefined} />
        <PrimaryButton label={primaryLabel} onClick={handlePrimary} />
        <LastFocus label="Last Focus Time" ms={lastEntry?.ms ?? 0} />
      </div>
      
      <PauseModal 
        show={showPauseModal} 
        onClose={() => setShowPauseModal(false)} 
      />
    </div>
  )
}
